import ExcelJS from "exceljs";

export type RecaudoDetail = {
 service_number: string; client_name: string | null; client_document: string | null;
 service_date: string | null; reconciliation_date: string; collection_amount: number;
 service_address: string | null; cedi_name: string; city_name: string;
};

export async function buildRecaudoWorkbook(rows: RecaudoDetail[], cediName: string, date: string) {
 const workbook = new ExcelJS.Workbook();
 const sheet = workbook.addWorksheet("Detalle del recaudo");
 sheet.addRow(["Droguería",cediName || "Sin droguería"]);
 sheet.addRow(["Fecha de conciliación",date]);
 sheet.addRow(["Ciudad",rows[0]?.city_name ?? ""]);
 sheet.addRow(["Estado incluido","Sin novedad"]);
 sheet.addRow(["Detalle","Los identificadores corresponden a guías / servicios cargados en Conciliación."]);
 sheet.addRow([]);
 const header = sheet.addRow(["N° guía / servicio","Nombre del cliente","Documento","Fecha del servicio","Fecha de conciliación","Dirección","Recaudo"]);
 header.font = {bold:true,color:{argb:"FFFFFFFF"}};
 header.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF164E63"}};
 sheet.columns.forEach((column,index) => { column.width=[22,30,22,22,24,40,20][index]; });
 for(const row of rows) sheet.addRow([
 row.service_number,row.client_name ?? "",row.client_document ?? "",row.service_date ?? "",
 row.reconciliation_date,row.service_address ?? "",Number(row.collection_amount),
 ]);
 const total = rows.reduce((sum,row) => sum + Number(row.collection_amount),0);
 const totalRow=sheet.addRow(["TOTAL","","","","","",{
 formula:`SUM(G8:G${7+rows.length})`,result:total,
 }]);
 totalRow.font={bold:true};
 sheet.getColumn(7).numFmt='"$"#,##0.00';
 sheet.views=[{state:"frozen",ySplit:7}];
 sheet.autoFilter={from:"A7",to:`G${7+rows.length}`};
 sheet.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
 return workbook.xlsx.writeBuffer();
}
