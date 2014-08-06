# istex-api-harvester

Programmes permettant de moissonner les corpus proposés par l'API de la plateforme ISTEX.

Plusieurs moissoneurs sont proposés dans différents languages de programmation :
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
istex-api-harvester --query hypertext --size 100 --fulltext 1
```

Les métadonnées au format MODS seront récupérées ainsi que le plein texte qui est la pluspart du temps au format pdf. Les données téléchargées sont stockées dans le répertoire "./springer/"
Pour les deux premiers documents téléchargés, on aura par exemple les fichiers suivants qui seront créés :
* ./springer/707770bf3aea02d1a81854bdd46533becfde35c9.mods.xml
* ./springer/707770bf3aea02d1a81854bdd46533becfde35c9.pdf
* ./springer/8db224e66c7fa77be4210d4d9ddb5dd84666066f.mods.xml
* ./springer/8db224e66c7fa77be4210d4d9ddb5dd84666066f.pdf

A noter que la longue chaîne de caractère est l'identifiant unique du document en question. A noter que le temps d'exécution du script dépend fortement de la qualité du réseau et du volume des données téléchargées.
