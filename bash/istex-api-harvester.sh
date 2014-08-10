#!/bin/bash
#
# Exemple de script shell d'extraction de documents (métadonnées + plein texte)
#
# Prérequis :
#   apt-get install jq
#   apt-get install curl
#   apt-get install wcalc
#

PAGE_SIZE=10
ISTEX_QUERY="hypertext"
ISTEX_URI="https://api.istex.fr/document/?q=$ISTEX_QUERY&size=$PAGE_SIZE"

# Outil JQ permettant de manipuler le JSON en ligne de commande
# http://stedolan.github.io/jq/
JQ="jq -c -M -r"

# Récupération de la première page pour connaître le nombre de documents
# et en déduire le nombre de page de résultats à télécharger
FIRST_PAGE=$(curl -s $ISTEX_URI)
TOTAL_DOC=$(echo $FIRST_PAGE | $JQ '.total')
TOTAL_PAGE=$(wcalc -q "ceil($TOTAL_DOC/$PAGE_SIZE) - 1")

echo "--> Téléchargement de $TOTAL_DOC documents"

# On récupère les pages de resultats une par une
for PAGE_N in $(seq 0 $TOTAL_PAGE)
do

  echo "--> Téléchargement de la page $PAGE_N/$TOTAL_PAGE"
  FROM=$(wcalc -q "$PAGE_N.0 * $PAGE_SIZE")
  URL="$ISTEX_URI&from=$FROM&output=fulltext,metadata"
  PAGE=$(curl -s $URL)
  NB_HITS=$(echo $PAGE | $JQ ".hits | length")

  # On récupère les différents documents (hits) de la page
  for DOC_IDX in $(seq 1 $NB_HITS)
  do
    DOC_IDX=$(wcalc -q "$DOC_IDX - 1")
    DOC=$(echo $PAGE | $JQ ".hits[$DOC_IDX]")
    DOC_ISTEXID=$(echo $DOC | $JQ ".id")
    DOC_FULLTEXT=$(echo $DOC | $JQ ".fulltext")
    DOC_METADATA=$(echo $DOC | $JQ ".metadata")
    DOC_NB_METADATA=$(echo $DOC_METADATA | $JQ ". | length")
    DOC_NB_FULLTEXT=$(echo $DOC_FULLTEXT | $JQ ". | length")
    
    # On récupère le document dont l'istexid a été extrait
    echo "--> Téléchargement du document $DOC_ISTEXID (nb meta = $DOC_NB_METADATA ; nb ft = $DOC_NB_FULLTEXT)"
    
    # On télécharge les métadonnées du document
    for DOC_META_IDX in $(seq 1 $DOC_NB_METADATA)
    do
      DOC_META_IDX=$(wcalc -q "$DOC_META_IDX - 1")
      URI=$(echo $DOC_METADATA | $JQ ".[$DOC_META_IDX].uri")
      FILETYPE=$(echo $DOC_METADATA | $JQ ".[$DOC_META_IDX].type")
      FILENAME="$DOC_ISTEXID.$FILETYPE"
      curl -s $URI > $FILENAME
      echo "--> Métadonnées téléchargé : $FILENAME"
    done
    
    # On télécharge les plein textes du document
    for DOC_FT_IDX in $(seq 1 $DOC_NB_FULLTEXT)
    do
      DOC_FT_IDX=$(wcalc -q "$DOC_FT_IDX - 1")
      URI=$(echo $DOC_FULLTEXT | $JQ ".[$DOC_FT_IDX].uri")
      FILETYPE=$(echo $DOC_FULLTEXT | $JQ ".[$DOC_FT_IDX].type")
      FILENAME="$DOC_ISTEXID.$FILETYPE"
      curl -s $URI > $FILENAME
      echo "--> Plein texte téléchargé : $FILENAME"
    done

  done
done
