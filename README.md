# Crypter

## Requirements
- [PHP7.2](https://php.net/)
- [Python3.7](https://www.python.org/)
- [Node](https://nodejs.org/)
- [psql](https://www.postgresql.org/)
- [node-gyp](https://www.npmjs.com/package/node-gyp)

## Installation
1. `git clone https://github.com/someApprentice/Crypter.git`
2. Install dependencies
    - `npm install`
    - `pip install -r requirements.txt`
    - `composer install`
3. Import `schema.sql`
4. Set enviroment variables (`./api/.env`, `./wamp/.env`)
5. `npm run build`
6. `node ./dist/server` & `python ./ws/server.py`

## Tests
- Backend tests `./api/bin/phpunit -c ./api/phpunit.xml.dist`
- WAMP tests `pytest --rootdir=./ws/tests/ --ignore=./ws/venv --ignore=./node_modules -v -s`
- Frontend tests `ng test`
