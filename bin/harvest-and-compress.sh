#!/bin/bash
# 
# Moissonne les métadonnées d'un corpus pour fournir à Ex-libris
# USAGE : ./harvest-and-compress.sh <corpusName> <outputDir> <isEbook=true|false> <extraOption>
# possible values for extraOption : --skip-dotcorpus

corpusName="$1"
outputDir="$2"
isEbook="$3"
extraOption="$4"

binDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
harvesterDir=$binDir/..
grep -E "^$corpusName$" "$harvesterDir/resources/forbidden.txt"
isForbidden=$?

if [ $isForbidden -eq 0 ]; then
    echo "🚨 Corpus interdit, licence interdisant le reversement dans une base tierce";
    exit 1
fi

#$harvesterDir/get-dotcorpus.njs -i -q "corpusName.raw:duke" -o exlibris-export/duke.corpus -c doi,arkIstex,host.issn,host.eissn,fulltext[0].uri

if [ "$extraOption" != "--skip-dotcorpus" ]; then
    if [ "$isEbook" = "true" ]; then 
        $harvesterDir/get-dotcorpus.njs -i -q "corpusName.raw:$corpusName" -o $outputDir/$corpusName.corpus -c doi,arkIstex,host.isbn,host.eisbn,fulltext[0].uri
    else
        $harvesterDir/get-dotcorpus.njs -i -q "corpusName.raw:$corpusName" -o $outputDir/$corpusName.corpus -c doi,arkIstex,host.issn,host.eissn,fulltext[0].uri
    fi
fi

#dotcorpus-harvest.njs -d exlibris-export/degruyter-journals.corpus -o exlibris-export/degruyter-journals -j $ISTEX_JWT -M mods -w 3

modsDir=$outputDir/$corpusName
# $harvesterDir/dotcorpus-harvest.njs -d $outputDir/$corpusName.corpus -o $outputDir/$corpusName -j $ISTEX_JWT -M mods -w 3
harvestModsScript="$binDir/harvest-mods.sh"
echo "starting harvesting mods..."
grep "^id"  $outputDir/$corpusName.corpus | cut -d ' ' -f 2 | parallel --gnu -j 3 -I {} $harvestModsScript {} $outputDir/$corpusName >> $outputDir/$corpusName-harvest-logs.txt 2>&1
echo "harvesting mods ended."

grep -E "^$corpusName$" "$harvesterDir/resources/no-abstract.txt"
noAbstract=$?

checksFilePath="$corpusName-checks.log"

if [ $noAbstract -eq 0 ]; then
    find "$modsDir" -type f -name "*.mods.xml" \
    | parallel --gnu -j 8 -I {} $binDir/remove-mods-abstract.sh {} "$corpusName" >> $checksFilePath
fi

mkdir -p $outputDir
rm $outputDir/$corpusName/.cursor
cd $outputDir

tar cvzf $corpusName.tar.gz $corpusName/ > /dev/null
rm -rf "$corpusName/"


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
