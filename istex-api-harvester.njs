#!/usr/bin/env node

var program   = require('commander');
var request   = require('superagent');
var uuid      = require('uuid');
var fs        = require('fs');
var mkdirp    = require('mkdirp');
var async     = require('async');
var prompt    = require('prompt');
var path      = require('path');
var package   = require('./package.json');

program
  .version(package.version)
  .option('-q, --query [requete]',       "La requete (?q=) ", '*')
  .option('-t, --scroll [scroll]',       "fonctionnalité de scrolling, conçue pour les besoins de parcours / extractions de gros ensembles", "")
  .option('-c, --corpus [corpus]',       "Le corpus souhaité (ex: springer, ecco, ...)", 'istex')
  .option('-f, --from [startingResult]', "rang du premier document à télécharge (0 par défaut", 0)
  .option('-s, --size [size]',           "Quantité de documents à télécharger", 10)
  .option('-M, --metadata [formats]',    "Pour retourner seulement certain formats de metadata (ex: mods,xml)", "all")
  .option('-F, --fulltext [formats]',    "Pour retourner seulement certain formats de plein text (ex: tei,pdf)", "")
  .option('-u, --username [username]',   "Nom d'utilisateur ISTEX", '')
  .option('-p, --password [password]',   "Mot de passe ISTEX", '')
  .option('-v, --verbose',               "Affiche plus d'informations", false)
  .option('-S, --spread',                "ventile des fichiers téléchargés dans une arborescence à 3 niveaux", false)
  .option('-H, --host [host:port]',      "interrogation sur un hostname (ou @IP) particulier", "")
  .option('-b, --sortby [sortMode]',     "tri sur un ou plusieurs champ", "")
  .option('-r, --rankby [rankMode]',     "mode de ranking", "")
  .option('-w, --workers [nbWorkers]',   "nombre de workers fonctionnant en parallèle (permet de télécharger plusieurs pages simultanément)", 1)
  .option('-o, --output [outputDir]',    "répertoire de destination (output ou nom de corpus si précisé)","output")
  .parse(process.argv);

var prefixUrl = (program.host !== "") ? "https://" + program.host : "https://api.istex.fr";

var dstPath = path.join(process.cwd(), program.output);
mkdirp.sync(dstPath);
var zipName = path.join(process.cwd(), uuid.v1() + '.zip');

var randomSeed = (new Date()).getTime();

var scrollId='';
// les paramètres metadata et fulltext peuvent contenir
// une liste de valeurs séparées par des virgules
program.metadata = program.metadata.split(',').filter(function (elt) { return elt != ''; });
program.fulltext = program.fulltext.split(',').filter(function (elt) { return elt != ''; });

// vérification sur le paramètre from
var from = parseInt(program.from,10);
if (from < 0) from = 0;

// découpe le téléchargement par pages
// pour éviter de faire une énorme requête
var nbHitPerPage = 100;
var nbPages      = Math.floor(program.size / nbHitPerPage);
var nbLastPage   = program.size - (nbPages * nbHitPerPage);
var ranges       = [];
for (var page = 0; page < nbPages; page++) {
  ranges.push([ from + page * nbHitPerPage,  nbHitPerPage]);
};
ranges.push([ from + nbPages * nbHitPerPage, nbLastPage ]);

// paramétrage de l'éventuel proxy http sortant
// en passant par la variable d'environnement http_proxy
require('superagent-proxy')(request);
var httpProxy = process.env.http_proxy || '';
function prepareHttpGetRequest(url) {
  var agent = request.agent();
  return httpProxy ? agent.get(url).proxy(httpProxy) : agent.get(url);
}

// lance les recherches et les téléchargements
console.log("Téléchargement de " + program.size +
            " documents (metadata & fulltext) à partir du résultat n° " + from);
console.log("Données téléchargées dans le répertoire : " + dstPath);

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
      downloadPages()
    });
  } else {
    downloadPages();
  }
});

/**
 * Fonction de téléchargement page par page
 */
function downloadPages() {
  var firstPage = true;
  async.mapLimit(ranges, program.workers, function (range, cb) {
    downloadPage(range, cb, function (body) {
      if (firstPage) {
        console.log("Nombre de documents dans le corpus sélectionné : " + body.total);
        firstPage = false;
      }
      if (program.scroll !== "") 
      {
        console.log('Vous avez déjà téléchargés ' + (range[0] + range[1] - from) + ' documents');
      }
      else{
        console.log('Téléchargement de la page ' +
                  ((range[0] - from) / nbHitPerPage +1) + ' (' + (range[0] + range[1] - from) + ' documents)');
      }
 
    });
  }, function (err) {
    if (err) return console.error(err);
    console.log('Téléchargements terminés');
  });
}

//
// Fonction de téléchargement d'une page
//  
function downloadPage(range, cb, cbBody) {
  var url = prefixUrl + '/document/?q='+program.query+'&output=metadata'
            + (program.fulltext.length != 0 ? ',fulltext' : '')
            + ((program.corpus == 'istex') ? '' : ('&corpus=' + program.corpus))
            + '&size=' + range[1];

  if (program.scroll !== ""){
    url += '&scroll=' + program.scroll;
  }
  else{
    url += '&from=' + range[0];
  }
  if (scrollId) url += '&scrollId='+scrollId;
  if (program.sortby !== "") url += '&sortBy=' + program.sortby;
  if (program.rankby !== "") url += '&rankBy=' + program.rankby;
  if (program.rankby == "random") url += '&randomSeed=' + randomSeed; 
  
  // sid permet de savoir plus facilement avec quel outil les documents istex ont été récupérés
  // ceci à des fins de statistiques (Accès tdm vs documentaire)
  url += '&sid=istex-api-harvester';

  // to ignore bad https certificate
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  prepareHttpGetRequest(url)
  .auth(program.username, program.password)
  .end(function (err, res) {
    if (err) {
      return cb(new Error(err));
    }
    if (!res || !res.body || !res.body.hits) {
      return cb(new Error('Response error: statusCode=' + res.statusCode));
    }

    // transmission du body pour les messages
    scrollId = res.body.scrollId;
    if (program.verbose){
        console.log(url);
    }
    cbBody(res.body);

    // lancement des téléchargement de façon séquentielle
    async.mapLimit(res.body.hits, 1, function (item1, cb2) {

      var downloadFn = [];

      // récupération de la liste des opérations
      // de téléchargement des métadonnées
      item1.metadata && item1.metadata.forEach(function (meta) {

        // ajoute également le  sid dans le téléchargement de la metadonnées
        meta.uri += '?sid=istex-api-harvester';
        
        // ignore les medadonnées non souhaitées
        if (program.metadata.indexOf(meta.extension) !== -1 || program.metadata.indexOf('all') !== -1) {
          // ajoute une opération de téléchargement
          // pour chaque métadonnées souhaitées
          downloadFn.push(function (callback) {
            if (program.verbose) {            
              console.log(meta);
            }
            // ventilation dans une arborescence à 3 niveaux
            var subFolders = (program.spread) ? path.join(item1.id[0], item1.id[1], item1.id[2]) : "" ; 
            mkdirp(path.join(dstPath,subFolders), function(err) {
              if (err) {
                console("Error creating directory " + path.join(dstPath,subFolders) );
                callback(err);
              } 
              var stream = fs.createWriteStream(path.join(
                            dstPath,
                            subFolders,
                            item1.id + '.metadata.' 
                              + (meta.original ? 'original.' : '')
                              + (meta.mimetype.indexOf(meta.extension) === -1 ? '.' + meta.extension + '.' : '')
                              + meta.mimetype.split('/').pop().replace('+', '.')));
              var req = prepareHttpGetRequest(meta.uri).auth(program.username, program.password);
              req.pipe(stream);
              stream.on('finish', function () {
                callback(null);
              });
              stream.on('error', callback);
            });
          });
        }
      });

      // récupération de la liste des opérations
      // de téléchargement des pleins textes
      item1.fulltext && item1.fulltext.forEach(function (ft) {
        
        // ajoute également le sid dans le téléchargement du fulltext
        ft.uri += '?sid=istex-api-harvester';

        // ignore les medadonnées non souhaitées
        if (program.fulltext.indexOf(ft.extension) !== -1 || program.fulltext.indexOf('all') !== -1) {
          // ajoute une opération de téléchargement
          // pour chaque plein texte souhaités
          downloadFn.push(function (callback) {
            if (program.verbose) {            
              console.log(ft);
            }
            // cas particuliers pour les tiff qui sont en fait des zip
            if (ft.mimetype == 'image/tiff') {
              ft.mimetype = 'application/zip';
            }
            // ventilation dans une arborescence à 3 niveaux
            var subFolders = (program.spread) ? path.join(item1.id[0], item1.id[1], item1.id[2]) : "" ; 
            mkdirp(path.join(dstPath,subFolders), function(err) {
              if (err) {
                console("Error creating directory " + path.join(dstPath,subFolders) );
                callback(err);
              } 

              var stream = fs.createWriteStream(path.join(
                            dstPath,
                            subFolders,
                            item1.id + '.fulltext.'
                              + (ft.original ? 'original.' : '')
                              + (ft.mimetype.indexOf(ft.extension) === -1 ? ft.extension + '.' : '')
                              + ft.mimetype.split('/').pop().replace('+', '.')));
              var req = request.get(ft.uri).auth(program.username, program.password);
              req.pipe(stream);
              stream.on('finish', function () {
                callback(null);
              });
              stream.on('error', callback);
            });
          }) 
        }
      });

      // download the metadata and the fulltext
      async.series(downloadFn, function (err) {
        // MODS and fulltext downloaded
        process.stdout.write('.');
        cb2(err);
      });

    }, function (err) {
      console.log('');
      // page downloaded
      cb(err, res.body);
    });

  });
}



/**
 * Tentative de connexion à l'API pour vérifier si
 * on a besoin d'indiquer des identifiants de connexion
 */
function checkIfAuthNeeded(program, cb) {
  // on ne cherche pas a authentifier si l'utilisateur ne demande
  // que des métadonnées non authentifiées (mods)
  if (program.metadata.length == 1 && program.metadata[0] == 'mods' &&
      program.fulltext.length == 0) {
    return cb(null, false);
  }
  // dans le cas contraire, avant de demander un login/mdp 
  // on vérifie si par hasard on n'est pas déjà autorisé (par IP)
  var url = prefixUrl + '/auth'; // document protégé
  prepareHttpGetRequest(url)
    .auth(program.username, program.password)
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
  prompt.message   = '';
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
      .end(function (err, res) {
        if (err) {
          return cb(new Error(err));
        }
        if (res.status !== 200) {
          // souci d'authentification, on relance le prompt
          console.log('[' + res.status + '] ' + res.text);
          return askLoginPassword(cb);
        } else {
          return cb(null, { username: program.username, password: program.password });
        }
      });
  });
}
