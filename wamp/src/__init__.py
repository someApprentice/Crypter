import sys, os

sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], 'services'))))
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], 'models'))))

from dotenv import load_dotenv

load_dotenv(override=True)


WAMP_ENV = os.getenv('WAMP_ENV')

if WAMP_ENV == 'development':
    load_dotenv(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', 'env.local'))), override=True)

if WAMP_ENV == 'production':
    load_dotenv(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', 'env.prod.local'))), override=True)

if WAMP_ENV == 'test':
    load_dotenv(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', 'env.test'))), override=True)