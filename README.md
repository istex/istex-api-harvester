# istex-api-harvester

Programmes permettant de moissonner les corpus proposés par l'API de la plateforme ISTEX.

Plusieurs moissonneurs sont proposés dans différents langages de programmation :
* [NodeJS](https://github.com/istex/istex-api-harvester/blob/master/nodejs/istex-api-harvester.njs)
* [Bash](https://github.com/istex/istex-api-harvester/blob/master/bash/istex-api-harvester.sh) (vocation pédagogique)
* ...

Le programme de moissonnage le plus complet est la version NodeJS. La suite de ce README documente donc l'utilisation de ce script.

## Pré requis

Les prérequis pour l'utiliser sont :
* Avoir nodejs d'installé sur sa machine (de préférence sur un OS de type Unix) -> http://nodejs.org/
* Disposer d'un accès réseau et d'avoir une adresse ip autorisée par la plateforme ISTEX

## Installation

```bash
npm install -g istex-api-harvester
```

## Usage

```
  Usage: istex-api-harvester [options]

  Options:

    -h, --help                 output usage information
    -V, --version              output the version number
    -q, --query [requete]      La requete (?q=) 
    -c, --corpus [corpus]      Le corpus souhaité (ex: springer, ecco, ...)
    -s, --size [size]          Quantité de documents à télécharger
    -md, --metadata [formats]  Pour retourner seulement certain formats de metadata (ex: mods,xml)
    -ft, --fulltext [formats]  Pour retourner seulement certain formats de plein text (ex: tei,pdf)
    -u, --username [username]  Nom d'utilisateur ISTEX
    -p, --password [password]  Mot de passe ISTEX
    -v, --verbose              Affiche plus d'informations
```

Par exemple pour moissonner les 850 premiers (ordre d'indexation) documents du corpus "springer" il faut taper ceci:
```bash
istex-api-harvester --corpus springer --size 850
```

Pour moissonner les 100 documents les plus pertinants correspondant à la requête "hypertex" tout corpus confondus :
```bash
istex-api-harvester --query hypertext --size 100
```

Pour moissonner également les pleins textes :
```bash
istex-api-harvester --query hypertext --size 100 --fulltext all
```

Les métadonnées au format MODS seront récupérées ainsi que le plein texte qui est la pluspart du temps au format pdf. Les données téléchargées sont stockées dans le répertoire "./springer/"
Pour les deux premiers documents téléchargés, on aura par exemple les fichiers suivants qui seront créés :
* ./springer/707770bf3aea02d1a81854bdd46533becfde35c9.mods.xml
* ./springer/707770bf3aea02d1a81854bdd46533becfde35c9.pdf
* ./springer/8db224e66c7fa77be4210d4d9ddb5dd84666066f.mods.xml
* ./springer/8db224e66c7fa77be4210d4d9ddb5dd84666066f.pdf

A noter que la longue chaîne de caractère est l'identifiant unique du document en question. A noter que le temps d'exécution du script dépend fortement de la qualité du réseau et du volume des données téléchargées.

Pour moissoner les 100 premiers documents (avec PDF) de la discipline **MATHEMATICS** sur le mot clé **Orthogonal** :
```bash
istex-api-harvester \
  --query 'Orthogonal AND categories.wos.raw:("MATHEMATICS")' \
  --fulltext pdf \
  --size 100
```
