# Permet « from cible_locale import … » quel que soit le dossier de lancement de pytest.
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
