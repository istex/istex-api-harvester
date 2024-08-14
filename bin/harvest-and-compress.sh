#!/bin/bash

# USAGE : ./harvest-and-compress.sh <corpusName> <outputDir>

corpusName="$1"
outputDir="$2"
isEbook="$3"

harvesterDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )/..


#$harvesterDir/get-dotcorpus.njs -i -q "corpusName.raw:duke" -o exlibris-export/duke.corpus -c doi,arkIstex,host.issn,host.eissn,fulltext[0].uri

if [ "$isEbook" = "true" ]; then 
    $harvesterDir/get-dotcorpus.njs -i -q "corpusName.raw:$corpusName" -o $outputDir/$corpusName.corpus -c doi,arkIstex,host.isbn,host.eisbn,fulltext[0].uri
else
    $harvesterDir/get-dotcorpus.njs -i -q "corpusName.raw:$corpusName" -o $outputDir/$corpusName.corpus -c doi,arkIstex,host.issn,host.eissn,fulltext[0].uri
fi

#dotcorpus-harvest.njs -d exlibris-export/degruyter-journals.corpus -o exlibris-export/degruyter-journals -j $ISTEX_JWT -M mods -w 3

$harvesterDir/dotcorpus-harvest.njs -d $outputDir/$corpusName.corpus -o $outputDir/$corpusName -j $ISTEX_JWT -M mods -w 3

mkdir -p $outputDir
rm $outputDir/$corpusName/.cursor
cd $outputDir
tar cvzf $corpusName.tar.gz $corpusName/ > /dev/null
rm -rf "$corpusName/"

checksFilePath="$corpusName-checks.log"

echo -n "Nombre de lignes dans le fichier .corpus : " >> $checksFilePath
grep 'id ' $corpusName.corpus | wc -l >> $checksFilePath

echo "début du fichier .corpus : " >> $checksFilePath
head -15 $corpusName.corpus >> $checksFilePath

echo "\n -------------------- \n" >> $checksFilePath

echo -n "Nombre de lignes  dans le fichier csv : " >> $checksFilePath
cat $corpusName.csv | wc -l >> $checksFilePath

echo -n "Début du fichier csv : " >> $checksFilePath
head -15 $corpusName.csv >> $checksFilePath

echo "\n -------------------- \n" >> $checksFilePath

echo -n "Nombre de fichiers Mods dans le tar.gz : " >> $checksFilePath
tar tvzf $corpusName.tar.gz | grep mods | wc -l >> $checksFilePath

echo -n "Taille du fichier tar.gz : " >> $checksFilePath
du -h $corpusName.tar.gz >> $checksFilePath


cd - > /dev/null
