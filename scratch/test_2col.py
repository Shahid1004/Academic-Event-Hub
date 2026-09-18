import docx
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

doc = docx.Document()
doc.add_paragraph("Title across 1 column")
new_sec = doc.add_section(docx.enum.section.WD_SECTION.CONTINUOUS)
cols = parse_xml(f'<w:cols {nsdecls("w")} w:num="2" w:space="360"/>')
new_sec._sectPr.append(cols)
for i in range(20):
    doc.add_paragraph(f"Paragraph {i}: " + ("This is two-column IEEE text content flowing naturally. " * 15))
doc.save("test_2col.docx")
print("Saved 2-column test docx successfully")
