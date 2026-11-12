# Bibliothèques embarquées (copie locale, version figée)

Copiées depuis npm pour que ClimPilot s'ouvre hors ligne (service worker) et ne change jamais de version tout seul.
Depuis la mission S (10/11/2026), **aucune bibliothèque n'est plus chargée depuis un CDN** : tout vient de ce dossier, et la
politique de sécurité de la page (CSP, balise `meta` de `index.html`) n'autorise que l'origine du site pour les scripts.

| Fichier | Paquet npm | Licence | Empreinte sha384 |
|---|---|---|---|
| supabase-js-2.117.3.umd.js | @supabase/supabase-js 2.117.3 (dist/umd/supabase.js) | MIT | dans `index.html` (`integrity`) |
| chart-4.5.0.umd.js | chart.js 4.5.0 (dist/chart.umd.js) | MIT | dans `index.html` (`integrity`) |
| xlsx-0.18.5.full.min.js | xlsx 0.18.5 (dist/xlsx.full.min.js), lecture des tarifs Excel | Apache-2.0 | `sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw` (dans `next-catalogue.js`) |
| jszip-3.10.1.min.js | jszip 3.10.1 (dist/jszip.min.js), export ZIP des factures électroniques | MIT (double licence MIT ou GPL-3.0 : MIT retenue) | `sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG` (dans `next-einvoice.js`) |
| tesseract-5.1.1.min.js | tesseract.js 5.1.1 (dist/tesseract.min.js), lecture de plaque | Apache-2.0 | `sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F` (dans `next-addons.js`) |
| tesseract-worker-5.1.1.min.js | tesseract.js 5.1.1 (dist/worker.min.js) | Apache-2.0 | `sha384-zxn+VqofFzXpH99dUb3fa4ywoSBQJPy6/6oEaJHPlblZXr53a0g1Jl6720vgSzB7` |
| tesseract-core/tesseract-core-simd-lstm.wasm.js | tesseract.js-core 5.1.1 (moteur WASM, processeurs avec SIMD) | Apache-2.0 | `sha384-YM1G+zaWYy9VSRP2C101LCgzh7n3Hqb6OEm9qDoZYgCADsni3nnECskC3WialQB7` |
| tesseract-core/tesseract-core-lstm.wasm.js | tesseract.js-core 5.1.1 (moteur WASM, repli sans SIMD : vieux téléphones) | Apache-2.0 | `sha384-EKWY5JDwphQoyxhvYU7eaCcyQ0EdV6fZK3L2vzfZcv2ichRdNd6pSnyWPNv6fMuR` |
| tessdata/fra.traineddata.gz | @tesseract.js-data/fra 1.0.0 (4.0.0_best_int), langue française | MIT (paquet) ; données Tesseract OCR, Apache-2.0 | `sha384-17mFcIab6O9tDbGEStxwnT8sNuUpPvMJ4a3PAfC3QNRobMzxAsQECc4h+tHWGcFK` |
| tessdata/eng.traineddata.gz | @tesseract.js-data/eng 1.0.0 (4.0.0_best_int), langue anglaise | MIT (paquet) ; données Tesseract OCR, Apache-2.0 | `sha384-JI+fraGAoc5GBGIliuqzHRnP1nJyrukg5ggNSBv/TO+YOVj+6Te6XXQOx7ia10xq` |

Taille ajoutée par la lecture de plaque (six fichiers Tesseract) : 11,7 Mo, mise en cache hors ligne par `sw.js` comme le reste de l'appli.

Le navigateur vérifie lui-même l'empreinte des trois scripts chargés par une balise `<script>` (`integrity`). Le worker, les deux
moteurs et les deux langues sont chargés par le worker lui-même (`importScripts`, `fetch`), où le navigateur ne vérifie pas
d'empreinte : ce sont des fichiers de la même origine que l'appli, servis comme elle ; leur empreinte est écrite ici et contrôlée
par la batterie de tests (suite AB), qui échoue si l'un d'eux change.

Mettre à jour : télécharger la nouvelle version depuis npm (`npm pack <paquet>@<version>`), changer le nom du fichier, recalculer
l'empreinte (`openssl dgst -sha384 -binary <fichier> | base64 -w0`), la reporter dans la couche qui charge le fichier et dans ce
tableau, mettre à jour la liste et `C` dans `sw.js`, puis lancer la batterie.

## Licence de supabase-js

MIT License

Copyright (c) 2020 Supabase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Licence de Chart.js

The MIT License (MIT)

Copyright (c) 2014-2024 Chart.js Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Licence de JSZip (MIT retenue)

JSZip is dual licensed. At your choice you may use it under the MIT license or the GPLv3 license.

The MIT License

Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Licence des paquets @tesseract.js-data/fra et @tesseract.js-data/eng (MIT) ; données de langue Tesseract OCR (Apache-2.0)

MIT License — Copyright (c) 2023 Balearica. Les fichiers `*.traineddata` sont les modèles de langue du projet Tesseract OCR (tessdata_best, 4.0.0, forme entière),
publiés sous licence Apache-2.0 par les auteurs de Tesseract OCR.

## Licence de SheetJS (xlsx), tesseract.js et tesseract.js-core : Apache License 2.0

SheetJS Community Edition : Copyright (C) 2012-present SheetJS LLC. tesseract.js et tesseract.js-core : Copyright (c) 2017-2024 Balearica et contributeurs (projet naptha/tesseract.js).

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
