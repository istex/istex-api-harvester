#!/usr/bin/env node

const program = require('commander');
const request = require('superagent');
const async = require('async');
const fs = require('fs');
const dateformat = require('dateformat');
const agent = request.agent();
const package = require('./package.json');
const cliProgress = require('cli-progress');
const readline = require('readline');

program
  .version(package.version)
  .option('-q, --query [requete]', "La requete (?q=) ", '*')
  .option('-j, --jwt [token]', "Le token à utiliser pour l'authentification", 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ')
  .option('-o, --output [corpusFile path]', "fichier .corpus obtenu", ".corpus")
  .option('-i, --idIstex', "récupère des idIstex au lieu d'identifiants ARK", false)
  .option('-v, --verbose', "Affiche plus d'informations", false)
  .parse(process.argv);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const prefixUrl = 'https://api.istex.fr'
const scrollDuration = "1m";
const pageSize = 1000;
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
const firstCallUrl = prefixUrl + '/document/?q=' + program.query + '&output=id,arkIstex&scroll='+scrollDuration+'&size='+pageSize;
const dotCorpusPath = (program.output && program.output !== '') ? program.output : ".corpus";
let scrollAgain = true;
let nextScrollURI = '';

let outputStreamflag = 'a';
if (fs.existsSync(dotCorpusPath)) {
    rl.question('Fichier "+dotCorpusPath+" déjà existant. Voulez-vous l\'écraser ? ', (answer) => {
        if (!['o','O','y','Y'].includes(answer)) {
            console.log('Vous souhaitez le conserver. Veuillez donc choisir un autre emplacement.');
            process.exit(1);
        }
        rl.close();
        outputStreamflag = 'w';
        console.log('Vous souhaitez l\'écraser. Début du traitement.');
        startJob();
    });
}

let startJob = function() {
    var outputStream = fs.createWriteStream(dotCorpusPath, {
        flags: outputStreamflag,
        encoding: 'utf8'
    });

    outputStream.write(`#
# Fichier .corpus
#
query        : ${program.query}
date         : ${dateformat(new Date(), "isoDateTime")}

[ISTEX]
`);

    let total = 0, idx = 0;

    async.whilst(
        () => {return scrollAgain}
        , (cbWhilst) => {

            const url = (nextScrollURI !== '') ? nextScrollURI : firstCallUrl;
            if (program.verbose) console.log(url);

            // to ignore bad https certificate
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            agent.get(url)
            .set('Authorization', 'Bearer ' + program.jwt)
            .end(function (err, res) {
                if (err) {
                    console.log('ERROR intern: ', err);
                    return cb(new Error(err));
                }
                if (!res || !res.body || !res.body.hits) {
                    if (res.statusCode !== 404) {
                    return cb(new Error('Response error: statusCode=' + res.statusCode));
                    }
                    else {
                    console.error('ERROR %d retrieving next %s hits : scroll session may have expired. Try to increase value of -t/--scroll parameter.', res.statusCode, nbHitPerPage);
                    console.error('URL : %s', url);
                    return cb(new Error('Response error: statusCode=' + res.statusCode));
                    }
                }

                if (total===0) {
                    total = res.body.total;
                    console.log(res.body.total + " documents trouvés. Récupération des identifiants :")
                    console.log("progression");
                    bar1.start(res.body.total, 0);
                }
                if (res.body && res.body.hits.length > 0) {
                    idx += res.body.hits.length;
                    bar1.update(idx);
                }

                if (res.body.noMoreScrollResults) scrollAgain = false;
                if (res.body.nextScrollURI) nextScrollURI = res.body.nextScrollURI;

                if (program.idIstex) {
                    listIds = res.body.hits.map(hit => 'id '+hit.id);
                    outputStream.write(listIds.join("\n"));
                } else {
                    listArks = res.body.hits.map(hit => 'ark '+hit.arkIstex);
                    outputStream.write(listArks.join("\n"));
                }

                cbWhilst();

            });
        }, (err) => {
            outputStream.end();
            bar1.stop();
            if (err) return console.error(err);
            if (program.verbose) console.log('Téléchargements terminés');
        }
    );

}