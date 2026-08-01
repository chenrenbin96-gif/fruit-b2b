import { apiClient } from './client';
type Envelope<T>={data:T};
export const customerCenterApi={
  async customers(params:Record<string,unknown>={}){return (await apiClient.get<Envelope<Record<string,any>[]>>('/admin/customers',{params})).data.data;},
  async customer(id:string){return (await apiClient.get<Envelope<Record<string,any>>>(`/admin/customers/${id}`)).data.data;},
  async saveCustomer(id:string|null,data:Record<string,unknown>){return (await (id?apiClient.put(`/admin/customers/${id}`,data):apiClient.post('/admin/customers',data))).data.data;},
  async types(){return (await apiClient.get<Envelope<Record<string,any>[]>>('/admin/customer-types')).data.data;},
  async saveType(data:Record<string,unknown>){await apiClient.post('/admin/customer-types',data);},
  async groups(){return (await apiClient.get<Envelope<Record<string,any>[]>>('/admin/customer-groups')).data.data;},
  async saveGroup(data:Record<string,unknown>){await apiClient.post('/admin/customer-groups',data);},
  async tags(){return (await apiClient.get<Envelope<Record<string,any>[]>>('/admin/customer-tags')).data.data;},
  async saveTag(data:Record<string,unknown>){await apiClient.post('/admin/customer-tags',data);},
  async agreements(params:Record<string,unknown>={}){return (await apiClient.get<Envelope<Record<string,any>[]>>('/admin/customer-prices',{params})).data.data;},
  async saveAgreement(data:Record<string,unknown>){await apiClient.post('/admin/customer-prices',data);},
  async dashboard(id:string){return (await apiClient.get<Envelope<Record<string,any>>>(`/admin/customers/${id}/dashboard`)).data.data;},
  async orders(id:string){return (await apiClient.get<Envelope<Record<string,any>[]>>(`/admin/customers/${id}/orders`)).data.data;},
  async history(id:string){return (await apiClient.get<Envelope<Record<string,any>[]>>(`/admin/customers/${id}/history`)).data.data;},
  async credit(id:string){return (await apiClient.get<Envelope<Record<string,any>>>(`/admin/customers/${id}/credit`)).data.data;},
  async adjustCredit(id:string,data:Record<string,unknown>){return (await apiClient.put(`/admin/customers/${id}/credit`,data)).data.data;},
};
