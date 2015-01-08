#!/usr/bin/env node

var program   = require('commander');
var request   = require('superagent');
var uuid      = require('uuid');
var fs        = require('fs');
var mkdirp    = require('mkdirp');
var async     = require('async');
var prompt    = require('prompt');
var package   = require('./package.json');

program
  .version(package.version)
  .option('-q, --query [requete]', "La requete (?q=) ", '*')
  .option('-c, --corpus [corpus]', "Le corpus souhaité (ex: springer, ecco, ...)", 'istex')
  .option('-s, --size [size]',     "Quantité de documents à télécharger", 10)
  .option('-ft, --fulltext [0|1]', "Pour retourner ou pas le plein texte", 0)
  .option('-u, --username [username]',        "Nom d'utilisateur ISTEX", '')
  .option('-p, --password [password]',        "Mot de passe ISTEX", '')
  .option('-v, --verbose',         "Affiche plus d'informations", false)
  .parse(process.argv);

var dstPath = process.cwd() + '/' + program.corpus;
mkdirp.sync(dstPath);
var zipName = process.cwd() + '/' + uuid.v1() + '.zip';

// découpe le téléchargement par pages
// pour éviter de faire une énorme requête
var nbHitPerPage = 100;
var nbPages      = Math.floor(program.size / nbHitPerPage);
var nbLastPage   = program.size - (nbPages * nbHitPerPage);
var ranges       = [];
for (var page = 0; page < nbPages; page++) {
  ranges.push([ page * nbHitPerPage,  nbHitPerPage]);
};
ranges.push([ nbPages * nbHitPerPage, nbLastPage ]);

// lance les recherches et les téléchargements
console.log("Téléchargement des " + program.size +
            " premiers documents (metadata & fulltext) ici : " + dstPath);

/**
 * Point d'entrée
 * - vérifie si authentification nécessaire
 * - demande le login/password si nécessaire
 * - lance le téléchargement
 */
checkIfAuthNeeded(function (err, needAuth) {
  if (err) return console.error(err);
  if (needAuth) {
    askLoginPassword(downloadPages);
  } else {
    downloadPages();
  }
});

/**
 * Fonction de téléchargement page par page
 */
function downloadPages() {
  var firstPage = true;
  async.mapLimit(ranges, 1, function (range, cb) {
    downloadPage(range, cb, function (body) {
      if (firstPage) {
        console.log("Nombre de documents dans le corpus " + program.corpus + " : " + body.total);
        firstPage = false;
      }
      console.log('Téléchargement de la page ' +
                  (range[0] / nbHitPerPage +1 ) + ' (' + (range[0] + range[1]) + ' documents)');
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
  var url = 'https://api.istex.fr/document/?q='+program.query+'&output=metadata'
            + (program.fulltext != 0 ? ',fulltext' : '')
            + ((program.corpus == 'istex') ? '' : ('&corpus=' + program.corpus))
            + '&from=' + range[0] + '&size=' + range[1];
  console.log(url);

  // to ignore bad https certificate
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  var agent = request.agent();
  agent
  .get(url)
  .auth(program.username, program.password)
  .end(function (err, res) {
    if (err) {
      return cb(new Error(err));
    }
    if (!res || !res.body || !res.body.hits) {
      return cb(new Error('Response error: statusCode=' + res.statusCode));
    }

    // transmission du body pour les messages
    cbBody(res.body);

    // lancement des téléchargement de façon séquentielle
    async.mapLimit(res.body.hits, 1, function (item1, cb2) {
      // extract the MODS from the returned JSON
      var mods = { url: '', filename: item1.id + '.mods.xml' };
      item1.metadata.forEach(function (item2) {
        if (item2.type && item2.type == 'mods') {
          mods.url = item2.uri;
        }
      });
      if (program.fulltext) {
        // extract the fulltext from the returned JSON
        var fulltext = { url: '', filename: '' };
        item1.fulltext.forEach(function (item2) {
          if (item2.type) {
            fulltext.url      = item2.uri;
            fulltext.filename = item1.id + '.' + item2.type;
          }
        });
      }

      // download the document (MODS and fulltext)
      async.series([
        // download the MODS
        function (callback) {
          var stream = fs.createWriteStream(dstPath + '/' + mods.filename);
          var req = request.get(mods.url).auth(program.username, program.password);
          req.pipe(stream);
          stream.on('finish', function () {
            if (program.verbose) {
              console.log(mods.url);
            }
            callback(null);
          });
          stream.on('error', callback);
        },
        // download the fulltext
        function (callback) {
          if (!program.fulltext) return callback(null);
          var stream = fs.createWriteStream(dstPath + '/' + fulltext.filename);
          var req = request.get(fulltext.url).auth(program.username, program.password);
          req.pipe(stream);
          stream.on('finish', function () {
            if (program.verbose) {
              console.log(fulltext.url);
            }
            callback(null);
          });
          stream.on('error', callback);
        },
      ], function (err) {
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
function checkIfAuthNeeded(cb) {
  var url = 'https://api.istex.fr/corpus/';
  var agent = request.agent();
  agent
    .get(url)
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
    var url = 'https://api.istex.fr/corpus/';
    var agent = request.agent();
    agent
      .get(url)
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