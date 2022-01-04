#!/usr/bin/env node
"use strict";

const program = require('commander');
const request = require('superagent');
const path = require('path');
const async = require('async');
const fs = require('fs');
const es = require('event-stream');
const prompt = require('prompt');
const jsonPackage = require('./package.json');
const cliProgress = require('cli-progress');
const readline = require('readline');

var tabVer = process.versions.node.split('.');
var major = Number.parseInt(tabVer[0]);
var minor = Number.parseInt(tabVer[1]);
if (major < 10 || (major===10 && minor<12)) {
  console.error('La version 10.12 et supérieure de Node est requise.');
  process.exit(1);
}

program
  .version(jsonPackage.version)
  .option('-d, --dotcorpus [dotcorpus path]', "Path du fichier dotcorpus", '.corpus')
  .option('-j, --jwt [token]', "Le token à utiliser pour l'authentification", '')
  .option('-o, --output [outputdir path]', "Répertoire où seront téléchargés les fichiers", "out")
  .option('-M, --metadata [formats]', "Pour retourner seulement certain formats de metadata (ex: mods,xml)", "")
  .option('-F, --fulltext [formats]', "Pour retourner seulement certain formats de plein text (ex: tei,pdf)", "")
  .option('-w, --workers [nbWorkers]', "nombre de workers fonctionnant en parallèle (permet de télécharger plusieurs pages simultanément)", 1)
  .option('-H, --host [host:port]', "interrogation sur un hostname (ou @IP) particulier", "")
  .option('-v, --verbose', "Affiche plus d'informations", false)
  .parse(process.argv);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const progressBar = new cliProgress.SingleBar({etaBuffer:50}, cliProgress.Presets.shades_classic);
const prefixUrl = (program.host !== "") ? "http://" + program.host : "https://api.istex.fr";
const dotCorpusPath = (program.dotcorpus && program.dotcorpus !== '') ? program.dotcorpus : ".corpus";
const outputDir = (program.output && program.output !== '') ? program.output : "./out";

// les paramètres metadata et fulltext peuvent contenir
// une liste de valeurs séparées par des virgules
program.metadata = program.metadata.split(',').filter(function (elt) {
  return elt !== '';
});
program.fulltext = program.fulltext.split(',').filter(function (elt) {
  return elt !== '';
});

const cursorPath = path.join(outputDir,'.cursor');
let cursor;


/**
 * Point d'entrée
 * - vérifie si authentification nécessaire
 * - demande le login/password si nécessaire
 * - lance le téléchargement
 */
let startJob = function () {

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  if (!fs.existsSync(cursorPath)) {
    cursor = 0;
    fs.writeFileSync(cursorPath,'0',{encoding:'utf8'});
  } else {
    const cursorString = fs.readFileSync(cursorPath,{encoding:'utf8'});
    cursor = parseInt(cursorString);
    if (isNaN(cursor)) {
      console.error("Fichier .cursor incorrect, session de téléchargement corrompue. On s'arrête");
      process.exit(0);
    }
  }


  checkIfAuthNeeded(program, function (err, needAuth) {
    if (err) return console.error(err);
    if (needAuth) {
      askLoginPassword(function (err) {
        if (err) return new Error(err);
        parseDotCorpus();
      });
    } else {
      parseDotCorpus();
    }
  });
};


let beforeIstexSection = true;
let idType = '';
let bulk = [], total;
let identifierGlobalIndex = 0;
const bulkSize = 100;

let parseDotCorpus = function() {
  let bulkIndex = 0;  
  const dcFileStream = fs.createReadStream(dotCorpusPath)
  .pipe(es.split())
  .pipe(es.mapSync(function(line) {
    const l = line.trim();
    if (beforeIstexSection) {
      if (l.startsWith('total')) {
        total = parseInt(l.match(/\d+/));
        console.info("Nb de documents à télécharger : "+total);
        progressBar.start(total, 0);
      }
    } else {
      if (l.startsWith('id ')) {
        const matches = l.match(/[0-9A-F]{40}/);
        if (matches !== null && matches.length > 0) {
          bulk.push(matches[0]);
          idType='istex';
          identifierGlobalIndex++;
          bulkIndex++;
        }
      } else if (l.startsWith('ark ')) {
        const matches = l.match(/ark:\/67375\/[0-9A-Z]{3}-[0-9A-Z]{8}-[0-9A-Z]/);
        if (matches !== null && matches.length > 0) {
          bulk.push(matches[0]);
          idType='ark';
          identifierGlobalIndex++;
          bulkIndex++;
        }
      }
      if (bulkIndex >= bulkSize || identifierGlobalIndex === total) {
        bulkIndex = 0;
        if (identifierGlobalIndex > cursor) {
          if (program.verbose) console.debug(identifierGlobalIndex+","+cursor+' : bulk non traité',cursor);
          if (program.verbose) console.debug("pause stream (cursor="+cursor+", bulk size="+bulk.length+")");
          dcFileStream.pause();
          harvestBulk([...bulk],dcFileStream, (err)=> {
            // use spread operator syntax to clone bulk array
            if (err) console.error(err.message);
            if (cursor >= total) {
              if (program.verbose) console.debug("end stream (cursor="+cursor+", bulk size="+bulk.length+")");
              dcFileStream.end();
            }
          });
          bulk=[];
        } else {
          if (program.verbose) console.debug(identifierGlobalIndex+","+cursor+' : bulk déjà traité, on passe à la suite.');
          bulk = [];
        }
      }
    }

    if (line.indexOf('[ISTEX]') >= 0) {
      beforeIstexSection = false;
    } 
      
  })
  .on('error', function(err){
      console.log('Error while reading file.', err);
  })
  .on('end', function() {
    if (program.verbose) console.debug('dotcorpus file successfully read (bulk length = '+bulk.length+')');
    if (bulk.length > 0) {
      console.log("end");
        harvestBulk([...bulk],dcFileStream,()=>{
          harvestEnded();
      });
      bulk=[];
    } else {
      harvestEnded();
    }
  })
  );

};

let harvestEnded = function() {
  progressBar.stop();
  console.info("moissonnage terminé.");
  fs.writeFile(cursorPath,total,{encoding:'utf8'}, (err)=>{
    if (err) console.error(err.message);
    process.exit(0);
  });
};

// paramétrage de l'éventuel proxy http sortant
// en passant par la variable d'environnement http_proxy
require('superagent-proxy')(request);
const httpProxy = process.env.http_proxy || '';
function prepareHttpGetRequest(url) {
  const agent = request.agent();
  return httpProxy ? agent.get(url).proxy(httpProxy).redirects(0) : agent.get(url).redirects(0);
}

/**
 * Tentative de connexion à l'API pour vérifier si
 * on a besoin d'indiquer des identifiants de connexion
 */
function checkIfAuthNeeded(program, cb) {
  // on ne cherche pas a authentifier si l'utilisateur ne demande
  // que des métadonnées non authentifiées (mods)
  const metas = program.metadata.filter(elem => !['mods','json'].includes(elem));
  if (metas.length <= 0 && program.fulltext.length <= 0) {
    return cb(null, false);
  }
  // dans le cas contraire, avant de demander un login/mdp 
  // on vérifie si par hasard on n'est pas déjà autorisé (par IP)
  let url = prefixUrl + '/auth'; // document protégé
  if (program.jwt !== '') {
    url += '?auth=jwt';
  }
  prepareHttpGetRequest(url)
    .set('Authorization', 'Bearer ' + program.jwt)
    .end(function (err, res) {
      if (res && res.statusCode === 302 && res.header.location.endsWith('api.istex.fr/auth')) {
        console.error("Vous avez demandé un format de fichier nécessitant authentification mais n'êtes pas authentifié.");
        console.error("Pour plus d'informations, ouvrez la page https://api.istex.fr/auth dans votre navigateur.");
        console.error("Pour vous authentifier par fédération d'identités, merci de renseigner un token JWT obtenu via https://api.istex.fr/token/");
        console.error("Si nécessaire, envoyer un message à contact@listes.istex.fr");
        process.exit(1);
      }
      if (err) {
        return cb(new Error(err));
      }
      if (res.status !== 200) {
        return cb(null, true);
      } else {
        return cb(null, false);
      }
    });
}

/**
 * Demande à l'utilisateur ses identifiants
 * et test si ils fonctionnent.
 */
function askLoginPassword(cb) {
  // affiche un prompt pour demander si nécessaire à l'utilisateur 
  // d'entrer un login et mot de passe ISTEX
  prompt.message = '';
  prompt.delimiter = '';
  prompt.start();
  prompt.get({
    properties: {
      username: {
        description: "Nom d'utilisateur ISTEX :",
        default: program.username,
        required: true
      },
      password: {
        description: "Mot de passe ISTEX :",
        default: program.password,
        hidden: true,
        required: true
      }
    }
  }, function (err, results) {
    if (err) return cb(err);

    // then try to auth
    program.username = results.username;
    program.password = results.password;
    let url = prefixUrl + '/corpus/';
    prepareHttpGetRequest(url)
      .auth(program.username, program.password)
      .set('Authorization', 'Bearer ' + program.jwt)
      .end(function (err, res) {
        if (err) {
          return cb(new Error(err));
        }
        if (res.status !== 200) {
          // souci d'authentification, on relance le prompt
          console.info('[' + res.status + '] ' + res.text);
          return askLoginPassword(cb);
        } else {
          return cb(null, {username: program.username, password: program.password});
        }
      });
  });
}


let harvestBulk = function(currentBulk,dotCorpusStream,cbHarvestBulk) {

  let idxBulk=0;

  // lancement des téléchargements en parallèle, dans la limite de 
  async.mapLimit(currentBulk, program.workers, function (docId, cbMapLimit) {
    idxBulk++;
    const progressIndex = cursor+idxBulk;

    const downloadFunction = [];

    program.metadata.forEach(function (format) {
      fillDownloadArray(downloadFunction, docId, progressIndex, 'metadata', format);
    });

    program.fulltext.forEach(function (format) {
      fillDownloadArray(downloadFunction, docId, progressIndex, 'fulltext', format);
    });
    
    // launch download all the metadata & fulltext files
    async.series(downloadFunction, function (dlErr) {
      if (dlErr) console.error(dlErr);
      fs.writeFile(cursorPath,Math.trunc(cursor / bulkSize) * bulkSize,{encoding:'utf8'}, (errWrite)=>{
        cbMapLimit(errWrite);
      });
    });

  } , function (err) {
    if (err) return console.error(err);
    dotCorpusStream.resume();
    cursor += currentBulk.length;
    if (program.verbose) {
      console.debug('bulk courant terminé (cursor='+cursor+')');}
    cbHarvestBulk(err);
  });

};

let fillDownloadArray = function(downloadArray, docId, progressIdx, formatType, format) {

  // ajoute également le sid dans le téléchargement de la metadonnées
  let formatUri = prefixUrl;
  if (idType === 'istex') formatUri += '/document/'+docId+'/'+formatType+'/'+format;
  const arkSubRoute = (formatType === 'metadata') ? 'record' : 'fulltext';
  if (idType === 'ark') formatUri += '/'+docId+'/'+arkSubRoute+'.'+format;
  formatUri += '?sid=istex-api-harvester';
  if (program.jwt !== '' && program.jwt !== 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ') {
    formatUri += '&auth=jwt';
  }

  // ajoute une opération de téléchargement
  // pour chaque métadonnée ou fulltext souhaité
  downloadArray.push(function (callbackDlFn) {
    // ventilation dans une arborescence à 3 niveaux
    const subId = (idType === 'istex') ? docId : docId.substring(15);
    const subFolders = path.join(subId[0], subId[1], subId[2]);

    fs.mkdir(path.join(outputDir, subFolders), {recursive:true}, function (err) {
      if (err) {
        console.error("Error creating directory " + path.join(outputDir, subFolders));
        callbackDlFn(err);
      }
      let docName = (idType === 'istex') ? docId : docId.substring(5).replace('/','_');
      docName += '.'+formatType+'.' + format;
      if (['mods','tei'].includes(format)) docName += ".xml";
      const stream = fs.createWriteStream(path.join(outputDir, subFolders, docName));

      //Contourner la redirection du /document/idIstex/metadata/json vers document/idIstex
      //Car on a par ex: un fichier Json contenant : "Found. Redirecting to /document/idIstex"
      if (format === 'json') {
          formatUri = formatUri.replace('metadata/json','');
      }
      
      let req = {};
      if (program.jwt !== '') {
        req = prepareHttpGetRequest(formatUri).set('Authorization', 'Bearer ' + program.jwt);
      } else {
        req = prepareHttpGetRequest(formatUri);
      }
      req.on('response',(resp)=>{
        if (resp.statusCode !== 200) {
          console.error(resp.error.message);
          return new Error(resp.error.message);
        } else {
          return resp;
        }
      });
      req.pipe(stream);
      stream.on('finish', function () {
        // console.log("progressIdx="+progressIdx+" format="+format);
        if (progressIdx > progressBar.value) progressBar.update(progressIdx);
        callbackDlFn(null);
      });
      stream.on('error', callbackDlFn);
    });
  });
};


if (fs.existsSync(outputDir)) {
  rl.question("Répertoire "+outputDir+" déjà existant. Essayez-vous de reprendre un téléchargement interrompu ? ", (answer) => {
      if (!['o','O','y','Y'].includes(answer)) {
          console.log('Pour un nouveau téléchargement, veuillez choisir un autre emplacement.');
          process.exit(1);
      }
      rl.close();
      console.log('Tentative de reprise du téléchargement...');
      startJob();
  });
} else {
  startJob();
}

