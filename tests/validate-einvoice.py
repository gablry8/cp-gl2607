import glob, sys, facturx
from lxml import etree
from saxonche import PySaxonProcessor
XSLT=__import__('os').environ.get('EN16931_XSLT','/tmp/claude-0/sp/en16931/cii/xslt/EN16931-CII-validation.xslt')
import os
FR=os.environ.get('BRFR_DIR','/tmp/claude-0/sp/frrfe/FNFE_RFE_INVOICE/CII/EN16931/2xslt')  # règles françaises officielles FNFE-MPE (git clone https://github.com/fnfempe/France_RFE)
proc=PySaxonProcessor(license=False); xp=proc.new_xslt30_processor(); ex=xp.compile_stylesheet(stylesheet_file=XSLT)
exfr=[(n,xp.compile_stylesheet(stylesheet_file=FR+'/'+n)) for n in ('BR-FR-Flux2-Schematron-CII.xslt','BR-FR-Flux2-Schematron-CII_WARNING.xslt') if os.path.exists(FR+'/'+n)]
ns={'svrl':'http://purl.oclc.org/dsdl/svrl'}
tot=0
for f in sorted(glob.glob(__import__('os').environ.get('XML_DIR','/tmp/claude-0/sp/xml')+'/*.xml')):
    data=open(f,'rb').read(); name=f.split('/')[-1]
    try: facturx.xml_check_xsd(data,flavor='factur-x',level='en16931'); xsd='XSD ok'
    except Exception as e: xsd='XSD FAIL: '+str(e)[:300]
    node=proc.parse_xml(xml_text=data.decode('utf-8'))
    fails=[]
    for nm,x in [('EN16931',ex)]+exfr:
        r=etree.fromstring(x.transform_to_string(xdm_node=node).encode('utf-8'))
        for fa in r.findall('.//svrl:failed-assert',ns):
            if 'WARNING' in nm and fa.get('flag')=='fatal': fa.set('flag','warning-fr')
            fails.append(fa)
    errs=[(fa.get('id') or '')+' ['+(fa.get('flag') or '')+'] '+''.join(fa.itertext()).strip()[:160] for fa in fails]
    hard=[e for e in errs if '[fatal]' in e]
    tot+=len(hard)+(0 if xsd=='XSD ok' else 1)
    print(name, xsd, '| EN16931 + BR-FR (%d jeux):'%len(exfr), 'OK' if not errs else str(len(errs))+' remarque(s)')
    for e in errs: print('   ',e)
print('TOTAL BLOQUANTS', tot)
