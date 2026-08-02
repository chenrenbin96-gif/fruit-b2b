import { apiClient } from './client';
type Envelope<T>={data:T};
export type ReportData={type:string;date_range:{from:string;to:string};summary:Record<string,number>;trend:Array<Record<string,any>>;rankings:Record<string,Array<Record<string,any>>>;items:Array<Record<string,any>>;pagination:{page:number;page_size:number;total:number;total_pages:number}};
export const reportsApi={
  async get(type:string,params:Record<string,unknown>){return (await apiClient.get<Envelope<ReportData>>(`/admin/reports/${type}`,{params})).data.data;},
  async export(type:string,params:Record<string,unknown>){const response=await apiClient.get(`/admin/reports/${type}/export`,{params,responseType:'blob'});const url=URL.createObjectURL(response.data);const a=document.createElement('a');a.href=url;a.download=`报表_${type}_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(url);},
};
