#!/usr/bin/env node
"use strict";

const program = require('commander');
const request = require('superagent');
const path = require('path');
const async = require('async');
const fs = require('fs');
const es = require('event-stream');
var prompt = require('prompt');
// const dateformat = require('dateformat');
// const agent = request.agent();
const jsonPackage = require('./package.json');
// const cliProgress = require('cli-progress');
const readline = require('readline');

program
  .version(jsonPackage.version)
  .option('-d, --dotcorpus [dotcorpus path]', "Path du fichier dotcorpus", '.corpus')
  .option('-j, --jwt [token]', "Le token à utiliser pour l'authentification", 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ')
  .option('-o, --output [outputdir path]', "Répertoire où seront téléchargés les fichiers", "out")
  .option('-M, --metadata [formats]', "Pour retourner seulement certain formats de metadata (ex: mods,xml)", "all")
  .option('-F, --fulltext [formats]', "Pour retourner seulement certain formats de plein text (ex: tei,pdf)", "")
  .option('-w, --workers [nbWorkers]', "nombre de workers fonctionnant en parallèle (permet de télécharger plusieurs pages simultanément)", 1)
  .option('-H, --host [host:port]', "interrogation sur un hostname (ou @IP) particulier", "")
  .option('-v, --verbose', "Affiche plus d'informations", false)
  .parse(process.argv);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var prefixUrl = (program.host !== "") ? "http://" + program.host : "https://api.istex.fr";
const dotCorpusPath = (program.dotcorpus && program.dotcorpus !== '') ? program.dotcorpus : ".corpus";
const outputDir = (program.output && program.output !== '') ? program.output : "./out";

if (fs.existsSync(outputDir)) {
  rl.question("Répertoire "+outputDir+" déjà existant. Essayez-vous de reprendre un téléchargement interrompu ? ", (answer) => {
      if (!['o','O','y','Y'].includes(answer)) {
          console.log('Pour un nouveau téléchargement, veuillez choisir un autre emplacement.');
          process.exit(1);
      }
      rl.close();
      console.log('Tentative de reprise du téléchargement...');
      /**
       * Point d'entrée
       * - vérifie si authentification nécessaire
       * - demande le login/password si nécessaire
       * - lance le téléchargement
       */
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
  });
}

// const dotcorpusName = path.basename(dotCorpusPath);
// const dotcorpusDLPath = path.join(outputDir,dotcorpusName);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const cursorPath = path.join(outputDir,'.cursor');
let cursor;

// if (fs.existsSync(dotCorpusPath) && !fs.existsSync(dotcorpusDLPath)) {
//   fs.copyFileSync(dotCorpusPath,dotcorpusDLPath);
// }

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


let beforeIstexSection = true;
let idType = '';
let bulk = [];
const bulkSize = 500;

let parseDotCorpus = function() {

  let indexNumber = 0;  
  var s = fs.createReadStream(dotCorpusPath)
  .pipe(es.split())
  .pipe(es.mapSync(function(line){
    if (beforeIstexSection) {
      // console.log('before');
    } else {
      const l = line.trim();
      if (l.startsWith('id ')) {
        const matches = l.match(/[0-9A-F]{40}/);
        if (matches !== null && matches.length > 0) {
          bulk.push(matches[0]);
          idType='istex';
          indexNumber++;
        }
      } else if (l.startsWith('ark ')) {
        // ark:/67375/HXZ-Q66QJ1BH-0
        const matches = l.match(/ark:\/67375\/[0-9A-Z]{3}-[0-9A-Z]{8}-[0-9A-Z]/);
        if (matches !== null && matches.length > 0) {
          bulk.push(matches[0]);
          idType='ark';
          indexNumber++;
        }
      }

      if (indexNumber >= bulkSize) {
        harvestBulk((err)=> {
          if (err) console.error(err.message);
          s.resume();
        });
        s.pause();
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
    if (bulk.length > 0) {
        harvestBulk(()=>{
        process.exit(0)  ;
      });
    }
    console.log('Read entire file.');
  })
  );

};

// paramétrage de l'éventuel proxy http sortant
// en passant par la variable d'environnement http_proxy
require('superagent-proxy')(request);
var httpProxy = process.env.http_proxy || '';
function prepareHttpGetRequest(url) {
  var agent = request.agent();
  return httpProxy ? agent.get(url).proxy(httpProxy) : agent.get(url);
}

// les paramètres metadata et fulltext peuvent contenir
// une liste de valeurs séparées par des virgules
program.metadata = program.metadata.split(',').filter(function (elt) {
  return elt !== '';
});
program.fulltext = program.fulltext.split(',').filter(function (elt) {
  return elt !== '';
});


/**
 * Tentative de connexion à l'API pour vérifier si
 * on a besoin d'indiquer des identifiants de connexion
 */
function checkIfAuthNeeded(program, cb) {
  // on ne cherche pas a authentifier si l'utilisateur ne demande
  // que des métadonnées non authentifiées (mods)
  if (program.metadata.length === 1 && program.metadata[0] === 'mods' &&
    program.fulltext.length === 0) {
    return cb(null, false);
  }
  // dans le cas contraire, avant de demander un login/mdp 
  // on vérifie si par hasard on n'est pas déjà autorisé (par IP)
  var url = prefixUrl + '/auth'; // document protégé
  if (program.jwt !== 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ') {
    url += '?auth=jwt';
  }
  prepareHttpGetRequest(url)
    .auth(program.username, program.password)
    .set('Authorization', 'Bearer ' + program.jwt)
    .end(function (err, res) {
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
    var url = prefixUrl + '/corpus/';
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


let harvestBulk = function(cbHarvestBulk) {

  // lancement des téléchargements en parallèle, dans la limite de 
  async.mapLimit(bulk, program.workers, function (docId, cbMapLimit) {

    program.metadata.forEach(function (format) {
      // ajoute également le sid dans le téléchargement de la metadonnées
      let formatUri = prefixUrl;
      if (idType === 'istex') formatUri += '/document/'+docId+'/metadata/'+format;
      if (idType === 'ark') formatUri += '/'+docId+'/record.'+format;
      formatUri += '?sid=istex-api-harvester';
      if (program.jwt !== 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ') {
        formatUri += '&auth=jwt';
      }
      if (program.verbose) console.log('try to dowload '+formatUri);

      const downloadFunction = [];

      // ajoute une opération de téléchargement
      // pour chaque métadonnées souhaitées
      downloadFunction.push(function (callbackDlFn) {
        // ventilation dans une arborescence à 3 niveaux
        const subId = (idType === 'istex') ? docId : docId.substring(15);
        const subFolders = path.join(subId[0], subId[1], subId[2]);

        fs.mkdir(path.join(outputDir, subFolders), {recursive:true}, function (err) {
          if (err) {
            console.error("Error creating directory " + path.join(outputDir, subFolders));
            callbackDlFn(err);
          }
          let docName = (idType === 'istex') ? docId : docId.substring(5).replace('/','_');
          docName += '.metadata.' + format;
          if (['mods','tei'].includes(format)) docName += ".xml";
          var stream = fs.createWriteStream(path.join(outputDir, subFolders, docName));

          //Contourner la redirection du /document/idIstex/metadata/json vers document/idIstex
          //Car on a par ex: un fichier Json contenant : "Found. Redirecting to /document/idIstex"
          if (format === 'json') {
              formatUri = formatUri.replace('metadata/json','');
          }
          
          var req = {};
          if (program.jwt !== 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ') {
            req = prepareHttpGetRequest(formatUri).set('Authorization', 'Bearer ' + program.jwt);
          }else{
            req = prepareHttpGetRequest(formatUri).auth(program.username, program.password);
          }
          req.pipe(stream);
          stream.on('finish', function () {
            callbackDlFn(null);
          });
          stream.on('error', callbackDlFn);
        });
      
      
      });

      // download the metadata and the fulltext
      async.series(downloadFunction, function (err) {
        // MODS and fulltext downloaded
        process.stdout.write('.');
        cbMapLimit(err);
      });

    });

  }, function (err) {
    if (err) return console.error(err);
    console.log('bulk courant terminé');
    cbHarvestBulk(err);
  });

};
