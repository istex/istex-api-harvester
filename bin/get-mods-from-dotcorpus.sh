#!/bin/bash
# 
# Rassemble les fichiers Mods
# USAGE : ./get-mods-from-dotcorpus.sh <corpusName> <outputDir> <corpusOutput>

corpusName="$1"
outputDir="$2"
corpusOutput="$3"

harvesterDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )/..


modsDir=$outputDir/$corpusName
mkdir -p "$modsDir"
dotcorpusPath="$outputDir/$corpusName.corpus"

# on parcours le fichiers .corpus
while IFS= read -r line; do
  # on ne traite que les lignes contenant un idIstex
  echo $line | grep -q -E "^id [A-Z0-F]{40}$" 
  if [ $? -eq 0 ]; then
    # on extrait l'idIstex
    idIstex=`echo $line | cut -d ' ' -f 2`
    modsPathFrom="$corpusOutput/${idIstex:0:1}/${idIstex:1:1}/${idIstex:2:1}/$idIstex/metadata/$idIstex.mods.xml"
    modsPathTo="$modsDir/${idIstex:0:1}/${idIstex:1:1}/${idIstex:2:1}/$idIstex.metadata.mods.xml"
    # si besoin on retire les résumés (cf corpus concernés dans fichier resources/no-abstract.txt)
    # et surtout, on recopie dans le rép de destination (via redirection)
    grep -E "^$corpusName$" "$harvesterDir/resources/no-abstract.txt"
    if [ $noAbstract -eq 0 ]; then
      xmlstarlet ed -P -N mods=http://www.loc.gov/mods/v3 -d '//mods:mods/mods:abstract' "$modsPathFrom" | xmllint --noblanks - > "$modsPathTo"
    else
      xmllint --noblanks "$modsPathFrom" > "$modsPathTo"
    fi
  fi
done < $dotcorpusPath

checksFilePath="$corpusName-checks.log"

# on compresse en tar.gz
cd $outputDir
tar cvzf $corpusName.tar.gz $corpusName/ > /dev/null
rm -rf "$corpusName/"

# on logge des infos
echo -n "Nombre de lignes dans le fichier .corpus : " >> $checksFilePath
grep 'id ' $corpusName.corpus | wc -l >> $checksFilePath

echo "début du fichier .corpus : " >> $checksFilePath
head -15 $corpusName.corpus >> $checksFilePath

echo "\n -------------------- \n" >> $checksFilePath

echo -n "Nombre de fichiers Mods dans le tar.gz : " >> $checksFilePath
tar tvzf $corpusName.tar.gz | grep mods | wc -l >> $checksFilePath

echo -n "Taille du fichier tar.gz : " >> $checksFilePath
du -h $corpusName.tar.gz >> $checksFilePath


cd - > /dev/null
