import { apiClient } from './client';

type Envelope<T>={data:T};
export type BiData={type:string;date_range:{from:string;to:string};summary:Record<string,number>;trend:Array<Record<string,any>>;rankings:Record<string,Array<Record<string,any>>>;items:Array<Record<string,any>>;pagination:{page:number;page_size:number;total:number;total_pages:number};generated_at:string};
export type BiDashboard={metrics:Record<string,number>;trends:Record<string,Array<Record<string,any>>>;generated_at:string;refresh_seconds:number;products?:Array<Record<string,any>>;customers?:Array<Record<string,any>>;deliveries?:Record<string,number>};

function downloadBlob(data:Blob,name:string){const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
export const biApi={
  async dashboard(){return (await apiClient.get<Envelope<BiDashboard>>('/admin/bi/dashboard')).data.data;},
  async screen(){return (await apiClient.get<Envelope<BiDashboard>>('/admin/bi/screen')).data.data;},
  async report(type:string,params:Record<string,unknown>){return (await apiClient.get<Envelope<BiData>>(`/admin/bi/reports/${type}`,{params})).data.data;},
  async export(type:string,format:'xlsx'|'csv'|'pdf',params:Record<string,unknown>){const response=await apiClient.get(`/admin/bi/reports/${type}/export`,{params:{...params,format},responseType:'blob'});downloadBlob(response.data,`BI_${type}_${new Date().toISOString().slice(0,10)}.${format}`);},
};
