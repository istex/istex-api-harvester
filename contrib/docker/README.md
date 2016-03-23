Docker et harvester
===================

Avertissements: 

- ce fonctionne que sous un docker host "natif" (docker-machine sous Windows ou MacOS non supporté)
- la version 2 de docker-compose est requise (>= 1.6.0)

Il faut définir les variables d'envionnement suivantes:

- XTRACTDIR: le répertoire sur le docker host qui va contenir l'extraction demandée
- XTRACTUID: l'UID de l'extracteur sur le host
- XTRACTGID: le GID de l'extracteur sur le host

Les deux dernières variables permettent à l'harvester de générer des fichiers ou des répertoires qui appartiendront à celui qui lance le conteneur docker.

Exemples d'utilisation:

    vagrant@docker:~/istex-api-harvester/contrib/docker$ docker-compose run --rm harvester -h
      
    Usage: istex-api-harvester [options]
      
      Options:
      
        -h, --help                 output usage information
        -V, --version              output the version number
        -q, --query [requete]      La requete (?q=) 
        -c, --corpus [corpus]      Le corpus souhaité (ex: springer, ecco, ...)
        -s, --size [size]          Quantité de documents à télécharger
        -m, --metadata [formats]   Pour retourner seulement certain formats de metadata (ex: mods,xml)
        -f, --fulltext [formats]   Pour retourner seulement certain formats de plein text (ex: tei,pdf)
        -u, --username [username]  Nom d'utilisateur ISTEX
        -p, --password [password]  Mot de passe ISTEX
        -v, --verbose              Affiche plus d'informations
        -S, --spread               ventile des fichiers téléchargés dans une arborescence à 3 niveaux
        -H, --host [host:port]     interrogation sur un hostname (ou @IP) particulier
        -b, --sortby [sortMode]    tri sur un ou plusieurs champ
        -o, --output [outputDir]   répertoire de destination (output ou nom de corpus si précisé)


    vagrant@docker:~/istex-api-harvester/contrib/docker$ docker-compose run --rm harvester -q docker -s 1
    Téléchargement des 1 premiers documents (metadata & fulltext) ici : /output
    Nom d'utilisateur ISTEX : samuel.clemens@inist.fr
    Mot de passe ISTEX : 
    Nombre de documents dans le corpus istex : 2375
    Téléchargement de la page 1 (1 documents)
    .
    Téléchargements terminés
    vagrant@docker:~/istex-api-harvester/contrib/docker$ ls $XTRACTDIR 
    B1E8E59E9CCD9FC7ADA7F3930D8C90E80BBB868E.metadata.mods.xml
    B1E8E59E9CCD9FC7ADA7F3930D8C90E80BBB868E.metadata.original.xml

