import type { ApiSuccessResponse } from '@fruit-b2b/contracts';
import { API_BASE_URL, request } from './request';
import { getAccessToken } from './token';
export type AfterSaleReason={id:string;name:string;sort:number;status:string};
export type AfterSale={id:string;after_sale_no:string;order_id:string;order_no?:string;status:string;reason:AfterSaleReason|null;refund_type:string;refund_amount:string;description?:string|null;review_remark?:string|null;created_at:string;items?:Array<{id:string;order_item_id:string;product_name:string;sku_name:string;sale_type:'PIECE'|'WEIGHT';quantity:string|null;approved_quantity:string|null;requested_weight:string|null;approved_weight:string|null;unit:string;purchased_quantity:string|null;purchased_weight:string|null;refund_price:string;refund_amount:string}>;media?:Array<{id:string;media_type:'IMAGE'|'VIDEO';url:string;thumbnail_url:string|null;sort:number}>;refund?:{status:string;amount:string}|null};
type UploadResult={url:string;thumbnail_url:string|null;size:number;type:string;duration:number|null};
function upload(path:string,filePath:string):Promise<UploadResult>{return new Promise((resolve,reject)=>{uni.uploadFile({url:`${API_BASE_URL}${path}`,filePath,name:'file',header:{Authorization:`Bearer ${getAccessToken()??''}`},success(response){try{const body=JSON.parse(response.data) as ApiSuccessResponse<UploadResult>&{message?:string};if(response.statusCode>=200&&response.statusCode<300)resolve(body.data);else reject(body);}catch{reject({message:'上传响应解析失败'});}},fail:reject});});}
export const afterSalesApi={
  async reasons(){return(await request<AfterSaleReason[]>({url:'/customer/after-sale-reasons'})).data;},
  async list(params?:{status?:string;page?:number;page_size?:number}){return(await request<{items:AfterSale[];pagination:{total:number}}>({url:`/customer/after-sales${params?.status?`?status=${params.status}`:''}`})).data;},
  async detail(id:string){return(await request<AfterSale>({url:`/customer/after-sales/${id}`})).data;},
  async create(data:Record<string,unknown>){return(await request<AfterSale>({url:'/customer/after-sales',method:'POST',data})).data;},
  uploadImage(filePath:string){return upload('/customer/upload/after-sale/image',filePath);},
  uploadVideo(filePath:string){return upload('/customer/upload/after-sale/video',filePath);},
};
