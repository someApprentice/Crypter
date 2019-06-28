import sys, os

sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', 'src'))))
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', 'src', 'models'))))
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', 'src', 'services'))))

from dotenv import load_dotenv

load_dotenv(os.path.abspath((os.path.join(os.path.split(__file__)[0], '..', '.env.test'))), override=True)