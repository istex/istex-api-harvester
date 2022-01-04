# istex-api-harvester

Utilitaire en ligne de commande permettant de moissonner les corpus proposés par l'API de la plateforme ISTEX.

En plus du présent moissonneur écrit en NodeJS, une [version expérimentale en BASH](https://github.com/istex/istex-api-harvester/tree/master/misc/bash) est disponible.

## 🚧 Important 🚧
La présente version NodeJS peut poser des problèmes de fiabilité dans le cas de très grosses volumétries (>10000 documents par exemple). Certains documents pourraient ne pas être téléchargés bien que faisant partie des résultats.

Pour cette raison, une nouvelle version **en 2 étapes** est en cours de développement. Bien que **tout à fait fonctionnelle**, elle n'est pas encore finalisée. Elle est disponible sur la branche [2-pass-harvesting](https://github.com/istex/istex-api-harvester/tree/2-pass-harvesting) du dépôt Github. **Nous vous invitons donc à utiliser de préférence cette version en 2 étapes.**

# Documentation du moissonneur
La présente documentation concerne la version obsolète en 1 étape.

![anim](https://cloud.githubusercontent.com/assets/328244/14159865/d012b4b6-f6d8-11e5-8dd2-7766896cd462.gif)

## Note de version importante
Depuis la version 2.5, et suite à l'introduction du paramètre `-f/--from` les paramètres `-f` (fulltext) et `-m` (metadata) on été renommés et doivent être saisis en majuscule `-F` et `-M`  

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

    -h, --help                   output usage information
    -V, --version                output the version number
    -q, --query [requete]        La requete (?q=) 
    -c, --corpus [corpus]        Le corpus souhaité (ex: springer, ecco, ...)
    -j, --jwt [token]            Le token (crée avec des attributs de l'utilisateur via la fédération d'identités) utilisé pour l'authentification
    -t, --scroll [scroll]        durée de vie d'un ensemble de réponses pour un parcours de type "scroll" pour les parcours / extractions de gros ensembles ("30s" par défaut)
    -f, --from [startingResult]  rang du premier document à télécharge (0 par défaut)
    -s, --size [size]            Quantité de documents à télécharger
    -M, --metadata [formats]     Pour retourner seulement certain formats de metadata (ex: mods,xml)
    -F, --fulltext [formats]     Pour retourner seulement certain formats de plein text (ex: tei,pdf)
    -u, --username [username]    Nom d'utilisateur ISTEX
    -p, --password [password]    Mot de passe ISTEX
    -v, --verbose                Affiche plus d'informations
    -S, --spread                 ventile des fichiers téléchargés dans une arborescence à 3 niveaux
    -H, --host [host:port]       interrogation sur une autre adresse que api.istex.fr (ex: "hostname:port")
    -b, --sortby [sortMode]      tri sur un ou plusieurs champ
    -r, --rankby [rankMode]      mode de ranking 
    -w, --workers [nbWorkers]    nombre de workers fonctionnant en parallèle (permet de télécharger plusieurs pages simultanément)
    -o, --output [outputDir]     répertoire de destination (output ou nom de corpus si précisé)
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

Pour moissoner un gros corpus avec de nombreux documents en utilisant l'option scroll :
```bash
istex-api-harvester -q scrum --scroll="150s" --fulltext=pdf,tei,txt --metadata=mods,xml --size=10000
```

Pour interroger l'API sur une autre machine $API_IP:$API_PORT (utile pour les développements) et sauvegarder les fichiers dans une arborescence à 3 niveaux :
```bash
istex-api-harvester \
  --query 'Agility' \
  --fulltext tei \
  --size 100 \
  --host $API_IP:$API_PORT \
  --spread
```
