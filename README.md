# istex-api-harvester

Programmes permettant de moissonner les corpus proposés par l'API de la plateforme ISTEX. Actuellement le moissoneur est écrit avec le langage de programmation NodeJS mais il est prévu de le proposer dans d'autres langages.

Ces programmes ont également une vocation pédagogique en montrant à la communauté comment l'API peut être moissonée par programme.

## Pré requis

Les prérequis pour l'utiliser sont :
* Avoir nodejs d'installé sur sa machine (de préférence sur un OS de type Unix) -> http://nodejs.org/
* Disposer d'un accès réseau et d'avoir une adresse ip autorisée par la plateforme ISTEX

## Installation

```bash
npm install -g istex-api-harvester
```

## Usage

Par exemple pour moissonner les 850 premiers documents du corpus "springer" il faut taper ceci:
```bash
istex-api-harvester --corpus springer --size 850
```

Pour moissonner les 100 premiers documents correspondant à la requête "hypertex" tous corpus confondus :
```bash
istex-api-harvester --query hypertext --size 100
```
Les métadonnées au format MODS seront récupérées ainsi que le plein texte qui est la pluspart du temps au format pdf. Les données téléchargées sont stockées dans le répertoire "./springer/"
Pour les deux premiers documents téléchargés, on aura par exemple les fichiers suivants qui seront créés :
* ./springer/707770bf3aea02d1a81854bdd46533becfde35c9.mods.xml
* ./springer/707770bf3aea02d1a81854bdd46533becfde35c9.pdf
* ./springer/8db224e66c7fa77be4210d4d9ddb5dd84666066f.mods.xml
* ./springer/8db224e66c7fa77be4210d4d9ddb5dd84666066f.pdf

A noter que la longue chaîne de caractère est l'identifiant unique du document en question. A noter que le temps d'exécution du script dépend fortement de la qualité du réseau et du volume des données téléchargées.
