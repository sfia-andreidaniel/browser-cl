#!/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )"

MYSQL=`which mysql`;

if [ -z $MYSQL ]; then echo -n "mysql command not found. use apt-get install mysql-client first.\n"; exit; fi

# echo "mysql     = $MYSQL";

if [ ! -f "../conf/database.sql" ]; then echo -n "the conf/database.sql file not found.\n"; exit; fi

unset username

read -p "Enter MySQL User [root]: " username

if [ -z $username ]; then username="root"; fi

while [ -z $password ]
do

unset password
prompt="Enter MySQL Password: "
while IFS= read -p "$prompt" -r -s -n 1 char
do
    if [[ $char == $'\0' ]]
    then
        break
    fi
    prompt='*'
    password+="$char"
done
echo

if [ -z $password ]; then echo "please provide a non-empty password!"; fi;

done

echo
echo

read -r -p "Are you sure you want to initialize mysql database? Existing data will be loss if any! [Y/n] " response
case $response in
    [yY][eE][sS]|[yY]) 
        ;;
    *)
        echo "Operation canceled"
        exit;
        ;;
esac

echo
echo


echo "* (re)initializing mysql database..."
cat ../conf/database.sql | $MYSQL "--user=$username" "--password=$password"

echo "* displaying results (if you see any errors below the operation FAILED!)"

$MYSQL "--user=$username" "--password=$password" -e "select * FROM ( ( SELECT count(1) AS uploads FROM uploads) AS uploads, ( SELECT count(1) AS tasks FROM uploads_tasks) AS tasks );" "transcoder"