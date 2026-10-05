import { z } from "zod";
import { getCurrentUser,can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { buildRecaudoWorkbook,type RecaudoDetail } from "@/lib/recaudos/export";

export async function GET(request:Request,{params}:{params:Promise<{clientId:string}>}) {
 const user=await getCurrentUser();
 if(!user || !can(user.permissions,"conciliacion.view") || !can(user.permissions,"conciliacion.export"))
   return new Response("No autorizado",{status:403});
 const {clientId}=await params;
 const sp=new URL(request.url).searchParams;
 const parsed=z.object({clientId:z.uuid(),date:z.iso.date(),city:z.uuid().nullable(),cedi:z.string().max(500)})
   .safeParse({clientId,date:sp.get("date"),city:sp.get("city") || null,cedi:sp.get("cedi")});
 if(!parsed.success) return new Response("Filtros inválidos",{status:400});
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("recaudos_detalle",{
 p_client_id:clientId,p_date:parsed.data.date,p_city_id:parsed.data.city,p_cedi_name:parsed.data.cedi,
 });
 if(error) return new Response("No se pudo generar el detalle. Intenta nuevamente.",{status:500});
 const rows=(data ?? []) as RecaudoDetail[];
 if(!rows.length) return new Response("No se encontraron registros para ese recaudo.",{status:404});
 const buffer=await buildRecaudoWorkbook(rows,parsed.data.cedi,parsed.data.date);
 return new Response(new Uint8Array(buffer),{headers:{
 "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 "Content-Disposition":`attachment; filename="recaudo-${parsed.data.date}.xlsx"`,
 "Cache-Control":"private, no-store",
 }});
}
