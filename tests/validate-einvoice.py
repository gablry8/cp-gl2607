# Validation des XML CII : XSD Factur-X (paquet factur-x) + règles officielles CEN EN 16931 (EN16931_XSLT)
# + règles françaises FNFE-MPE (BRFR_DIR, facultatif). Un validateur absent est ANNONCÉ (« ABSENT »),
# jamais compté comme réussi : la suite F enregistre alors SKIP.
import glob, os, sys, tempfile, facturx
from lxml import etree
from saxonche import PySaxonProcessor
XSLT = os.environ.get('EN16931_XSLT', '')
XML_DIR = os.environ.get('XML_DIR') or os.path.join(os.environ.get('CP_TEST_OUT') or os.path.join(tempfile.gettempdir(), 'climpilot-tests'), 'xml')
BRFR = os.environ.get('BRFR_DIR', '')
proc = PySaxonProcessor(license=False); xp = proc.new_xslt30_processor()
ex = xp.compile_stylesheet(stylesheet_file=XSLT) if XSLT and os.path.isfile(XSLT) else None
FR = BRFR and os.path.join(BRFR, 'FNFE_RFE_INVOICE/Factur-X/EN16931/2xslt/BR-FR-Flux2-Schematron-CII.xslt')
exfr = xp.compile_stylesheet(stylesheet_file=FR) if FR and os.path.isfile(FR) else None
print('CEN:', 'OK' if ex is not None else 'ABSENT (EN16931_XSLT)')
print('BR-FR:', 'OK' if exfr is not None else ('ABSENT (BRFR_DIR invalide)' if BRFR else 'non demandé'))
ns = {'svrl': 'http://purl.oclc.org/dsdl/svrl'}
tot = 0
for f in sorted(glob.glob(os.path.join(XML_DIR, '*.xml'))):
    data = open(f, 'rb').read(); name = os.path.basename(f)
    try: facturx.xml_check_xsd(data, flavor='factur-x', level='en16931'); xsd = 'XSD ok'
    except Exception as e: xsd = 'XSD FAIL: ' + str(e)[:300]
    errs = []
    for nom, x in (('', ex), ('BR-FR ', exfr)):
        if x is None: continue
        r = etree.fromstring(x.transform_to_string(xdm_node=proc.parse_xml(xml_text=data.decode('utf-8'))).encode('utf-8'))
        errs += [nom + (fa.get('id') or '') + ' [' + (fa.get('flag') or '') + '] ' + ''.join(fa.itertext()).strip()[:160] for fa in r.findall('.//svrl:failed-assert', ns)]
    hard = [e for e in errs if '[fatal]' in e]
    tot += len(hard) + (0 if xsd == 'XSD ok' else 1)
    regles = ' + '.join([n for n, x in (('EN16931', ex), ('BR-FR', exfr)) if x is not None]) or 'aucune règle (validateurs absents)'
    print(name, xsd, '| ' + regles + ':', 'OK' if not errs else str(len(errs)) + ' remarque(s)')
    for e in errs: print('   ', e)
print('TOTAL BLOQUANTS', tot)
