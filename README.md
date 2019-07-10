# Crypter

## Requirements
- [PHP7.1](https://php.net/)
- [Python3.7](https://www.python.org/)
- [Node](https://nodejs.org/)
- [psql](https://www.postgresql.org/)

## Installation
1. `git clone https://github.com/someApprentice/Crypter.git`
2. Install dependencies
    - `npm install`
    - `pip install -r requirements.txt`
    - `composer install`
3. Import `schema.sql`
4. Set enviroment variables (`./api/.env`, `./wamp/.env`)
5. `npm run build`
6. `node dist/server` & `crossbar start`

## Tests
- Backend tests `./api/bin/phpunit -c ./api/phpunit.xml.dist`
- WAMP tests `pytest --rootdir=./wamp/tests/ --ignore=./wamp/venv --ignore=./node_modules -v -s`
- Frontend tests `ng test`
