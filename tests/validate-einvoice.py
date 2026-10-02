import glob, sys, facturx
from lxml import etree
from saxonche import PySaxonProcessor
XSLT=__import__('os').environ.get('EN16931_XSLT','/tmp/claude-0/sp/en16931/cii/xslt/EN16931-CII-validation.xslt')
proc=PySaxonProcessor(license=False); xp=proc.new_xslt30_processor(); ex=xp.compile_stylesheet(stylesheet_file=XSLT)
# règles françaises officielles (FNFE-MPE, dépôt fnfempe/France_RFE) si BRFR_DIR est donné
BRFR=__import__('os').environ.get('BRFR_DIR')
exfr=xp.compile_stylesheet(stylesheet_file=BRFR+'/FNFE_RFE_INVOICE/Factur-X/EN16931/2xslt/BR-FR-Flux2-Schematron-CII.xslt') if BRFR else None
ns={'svrl':'http://purl.oclc.org/dsdl/svrl'}
tot=0
for f in sorted(glob.glob(__import__('os').environ.get('XML_DIR','/tmp/claude-0/sp/xml')+'/*.xml')):
    data=open(f,'rb').read(); name=f.split('/')[-1]
    try: facturx.xml_check_xsd(data,flavor='factur-x',level='en16931'); xsd='XSD ok'
    except Exception as e: xsd='XSD FAIL: '+str(e)[:300]
    out=ex.transform_to_string(xdm_node=proc.parse_xml(xml_text=data.decode('utf-8')))
    r=etree.fromstring(out.encode('utf-8'))
    fails=r.findall('.//svrl:failed-assert',ns)
    errs=[(fa.get('id') or '')+' ['+(fa.get('flag') or '')+'] '+''.join(fa.itertext()).strip()[:160] for fa in fails]
    if exfr is not None:
        rf=etree.fromstring(exfr.transform_to_string(xdm_node=proc.parse_xml(xml_text=data.decode('utf-8'))).encode('utf-8'))
        errs+=['BR-FR '+(fa.get('id') or '')+' ['+(fa.get('flag') or '')+'] '+''.join(fa.itertext()).strip()[:160] for fa in rf.findall('.//svrl:failed-assert',ns)]
    hard=[e for e in errs if '[fatal]' in e]
    tot+=len(hard)+(0 if xsd=='XSD ok' else 1)
    print(name, xsd, '| EN16931'+(' + BR-FR' if exfr is not None else '')+':', 'OK' if not errs else str(len(errs))+' remarque(s)')
    for e in errs: print('   ',e)
print('TOTAL BLOQUANTS', tot)
