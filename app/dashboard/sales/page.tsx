"use client";

import {
  ArrowDownToLine, ArrowUpFromLine, Eye, Loader2, PackageCheck, Pencil,
  Plus, RefreshCw, RotateCcw, Search, Trash2, WalletCards,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  DetailGrid, EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize, money, numberOrNull,
} from "@/components/RealUi";
import { RequirePermission } from "@/components/RequirePermission";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type OrderItem = {
  id:string; item_id:string; item_code_snapshot:string; item_name_snapshot:string;
  quantity:number|string; unit_price:number|string; discount_amount:number|string;
  tax_amount:number|string; line_total:number|string; notes:string|null
};
type Fulfillment = {
  id:string; carrier:string|null; tracking_number:string|null; shipping_cost:number|string|null;
  status:string; shipped_at:string|null; delivered_at:string|null; notes:string|null; created_at:string
};
type Order = {
  id:string; order_number:string; customer_id:string|null; customer_name:string|null;
  sales_channel_id:string|null; sales_channel_name:string|null; order_date:string; order_status:string;
  currency_code:string; shipping_amount:number|string; order_discount:number|string; notes:string|null;
  items_total:number|string; order_total:number|string; paid_amount:number|string; balance_due:number|string;
  payment_status:string; items:OrderItem[]; fulfillments:Fulfillment[]; created_at:string; updated_at:string
};
type ListResponse = { total:number; offset:number; limit:number; items:Order[] };
type Customer = { id:string; name:string; company_name:string|null };
type Item = { id:string; item_code:string; name:string; default_selling_price:number|string|null; quantity_available:number|string };
type Channel = { id:string; name:string; channel_type:string; is_active:boolean };
type Location = { id:string; location_code:string; name:string|null; operational_status:string };
type StockLine = {
  sales_order_item_id:string; item_id:string; item_code:string; item_name:string;
  ordered_quantity:number|string; reserved_quantity:number|string; fulfilled_quantity:number|string;
  remaining_to_fulfill:number|string;
};
type StockStatus = { id:string; order_number:string; order_status:string; items:StockLine[] };
type PaymentResult = { id:string; status:string };

const statuses = ["draft","confirmed","processing","partially_fulfilled","fulfilled","cancelled","returned","closed"];
const stockActions = ["reserve","release","fulfill","return"] as const;
type StockAction=(typeof stockActions)[number];

type SaleLine = { item_id:string; quantity:string; unit_price:string; discount_amount:string };
type PaymentType = "paid"|"partial"|"credit";
type NewSaleStockAction = "draft"|"reserve"|"fulfill";
type NewSaleForm = {
  customerMode:"walkin"|"existing"; customer_id:string; walkin_name:string; walkin_phone:string;
  storage_location_id:string; stockAction:NewSaleStockAction; lines:SaleLine[]; payment_type:PaymentType; amount_paid:string;
  payment_method:string; notes:string;
};
const emptyLine=():SaleLine=>({item_id:"",quantity:"1",unit_price:"",discount_amount:"0"});
const emptyNewSale=():NewSaleForm=>({
  customerMode:"walkin",customer_id:"",walkin_name:"",walkin_phone:"",storage_location_id:"",
  stockAction:"fulfill",lines:[emptyLine()],payment_type:"paid",amount_paid:"",payment_method:"cash",notes:"",
});
const lineTotal=(l:SaleLine)=>Math.max((Number(l.quantity)||0)*(Number(l.unit_price)||0)-(Number(l.discount_amount)||0),0);

function SalesPage() {
  const queryClient=useQueryClient();
  const { data: user } = useCurrentUser();
  const [search,setSearch]=useState("");
  const [debouncedSearch,setDebouncedSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"create"|"view"|"edit"|"stock"|"payment"|"newsale"|null>(null);
  const [selected,setSelected]=useState<Order|null>(null);
  const [stock,setStock]=useState<StockStatus|null>(null);
  const [saving,setSaving]=useState(false);
  const [newSale,setNewSale]=useState<NewSaleForm>(emptyNewSale());
  const [newSaleSaving,setNewSaleSaving]=useState(false);

  const [form,setForm]=useState({
    customer_id:"",sales_channel_id:"",order_status:"draft",shipping_amount:"0",
    order_discount:"0",notes:"",item_id:"",quantity:"1",unit_price:"",
  });
  const [stockForm,setStockForm]=useState({
    action:"reserve" as StockAction,line_id:"",item_name:"",storage_location_id:"",quantity:"1",unit_cost:"",notes:"",
  });
  const [paymentForm,setPaymentForm]=useState({amount:"",payment_method:"bank_transfer",reference:"",notes:""});

  const isManager=useMemo(()=>{
    const roles=new Set((user?.roles||[]).map(r=>r.toLowerCase()));
    return roles.has("manager")||roles.has("administrator");
  },[user]);

  useEffect(()=>{const t=setTimeout(()=>setDebouncedSearch(search),250);return()=>clearTimeout(t);},[search]);

  const listParams=useMemo(()=>({
    search:debouncedSearch.trim()||undefined,
    order_status:statusFilter||undefined,
  }),[debouncedSearch,statusFilter]);

  const ordersQuery=useQuery({
    queryKey:queryKeys.sales.list(listParams),
    queryFn:()=>{
      const p=new URLSearchParams({limit:"300"});
      if(listParams.search)p.set("search",listParams.search);
      if(listParams.order_status)p.set("order_status",listParams.order_status);
      return apiFetch<ListResponse>(`/sales-orders?${p.toString()}`);
    },
    staleTime:90*1000,
    gcTime:10*60*1000,
    placeholderData:keepPreviousData,
  });
  const orders=ordersQuery.data?.items??[];
  const loading=ordersQuery.isLoading;

  const customersLookupQuery=useQuery({
    queryKey:queryKeys.sales.customerLookup(),
    queryFn:()=>apiFetch<Customer[]>("/sales-orders/lookups/customers"),
    staleTime:5*60*1000,
  });
  const customers=customersLookupQuery.data??[];

  const itemsLookupQuery=useQuery({
    queryKey:queryKeys.sales.itemLookup(),
    queryFn:()=>apiFetch<Item[]>("/sales-orders/lookups/items?limit=300"),
    staleTime:2*60*1000,
  });
  const items=itemsLookupQuery.data??[];

  const channelsLookupQuery=useQuery({
    queryKey:queryKeys.sales.channelLookup(),
    queryFn:()=>apiFetch<Channel[]>("/sales-orders/lookups/channels"),
    staleTime:5*60*1000,
  });
  const channels=channelsLookupQuery.data??[];

  const locationsQuery=useQuery({
    queryKey:queryKeys.inventory.locations(),
    queryFn:()=>apiFetch<Location[]>("/inventory/locations"),
    staleTime:5*60*1000,
  });
  const locations=useMemo(
    ()=>(locationsQuery.data??[]).filter(x=>x.operational_status==="active"),
    [locationsQuery.data],
  );

  const load=()=>ordersQuery.refetch();

  const autoOpenedRef=useRef(false);
  useEffect(()=>{
    if(autoOpenedRef.current||locations.length===0)return;
    if(new URLSearchParams(window.location.search).get("action")==="new-sale"){
      autoOpenedRef.current=true;
      openNewSale();
    }
  },[locations]);

  function resetCreate(){
    setForm({customer_id:"",sales_channel_id:"",order_status:"draft",shipping_amount:"0",
      order_discount:"0",notes:"",item_id:"",quantity:"1",unit_price:""});
    setSelected(null);setStock(null);setMode("create");setError("");
  }

  function openNewSale(){
    setNewSale({...emptyNewSale(),storage_location_id:locations[0]?.id||""});
    setError("");setMode("newsale");
  }

  function updateLine(idx:number,patch:Partial<SaleLine>){
    setNewSale(s=>({...s,lines:s.lines.map((l,i)=>i===idx?{...l,...patch}:l)}));
  }
  function addLine(){setNewSale(s=>({...s,lines:[...s.lines,emptyLine()]}));}
  function removeLine(idx:number){setNewSale(s=>({...s,lines:s.lines.filter((_,i)=>i!==idx)}));}

  const newSaleTotal=useMemo(()=>newSale.lines.reduce((sum,l)=>sum+lineTotal(l),0),[newSale.lines]);

  async function submitNewSale(e:FormEvent){
    e.preventDefault();
    const validLines=newSale.lines.filter(l=>l.item_id&&Number(l.quantity)>0);
    if(validLines.length===0){setError("Add at least one product to the sale.");return;}
    if(newSale.customerMode==="existing"&&!newSale.customer_id){setError("Select a customer.");return;}
    if(newSale.stockAction!=="draft"&&!newSale.storage_location_id){setError("Select a storage location for this sale.");return;}
    const total=newSaleTotal;
    if(total<=0){setError("Sale total must be greater than zero.");return;}
    let amount=0;
    if(newSale.payment_type==="paid")amount=total;
    else if(newSale.payment_type==="partial"){
      amount=Number(newSale.amount_paid||0);
      if(!(amount>0)||amount>=total){setError("Partial payment must be greater than zero and less than the total.");return;}
    }

    setNewSaleSaving(true);setError("");
    try{
      // Validate real stock availability up front so we never create an order
      // we can't reserve/fulfill against — no partially-completed sale.
      if(newSale.stockAction!=="draft"){
        const invParams=new URLSearchParams({location_id:newSale.storage_location_id,limit:"300"});
        const inv=await apiFetch<{items:{item_id:string;quantity_available:number|string}[]}>(`/inventory?${invParams}`);
        const availableByItem=new Map(inv.items.map(r=>[r.item_id,Number(r.quantity_available)]));
        const shortages=validLines.reduce<string[]>((acc,l)=>{
          const available=availableByItem.get(l.item_id)??0;
          const requested=Number(l.quantity);
          if(requested>available){
            const item=items.find(i=>i.id===l.item_id);
            acc.push(`${item?.name||"Item"} (need ${requested}, only ${available} available at this location)`);
          }
          return acc;
        },[]);
        if(shortages.length>0){
          setError(`Not enough stock to ${newSale.stockAction==="reserve"?"reserve":"fulfill"}: ${shortages.join("; ")}.`);
          setNewSaleSaving(false);
          return;
        }
      }

      let customerId:string|null=newSale.customerMode==="existing"?newSale.customer_id:null;
      let customerLabel:string|null=null;
      if(newSale.customerMode==="walkin"&&newSale.walkin_name.trim()){
        const created=await apiFetch<{id:string;name:string}>("/customers",{method:"POST",body:JSON.stringify({
          customer_type:"retail",name:newSale.walkin_name.trim(),phone:newSale.walkin_phone.trim()||null,
        })});
        customerId=created.id;customerLabel=created.name;
      }

      const itemsPayload=validLines.map(l=>({
        item_id:l.item_id,quantity:Number(l.quantity),
        unit_price:l.unit_price?Number(l.unit_price):null,
        discount_amount:Number(l.discount_amount||0),tax_amount:0,notes:null,
      }));
      const order=await apiFetch<Order>("/sales-orders",{method:"POST",body:JSON.stringify({
        customer_id:customerId,sales_channel_id:null,
        order_status:newSale.stockAction==="draft"?"draft":"confirmed",
        shipping_amount:0,order_discount:0,notes:newSale.notes||null,items:itemsPayload,
      })});

      if(newSale.stockAction!=="draft"){
        for(const item of order.items){
          try{
            await apiFetch(`/sales-orders/${order.id}/items/${item.id}/reserve`,{method:"POST",body:JSON.stringify({
              storage_location_id:newSale.storage_location_id,quantity:Number(item.quantity),notes:"New sale",
            })});
            if(newSale.stockAction==="fulfill"){
              try{
                await apiFetch(`/sales-orders/${order.id}/items/${item.id}/fulfill`,{method:"POST",body:JSON.stringify({
                  storage_location_id:newSale.storage_location_id,quantity:Number(item.quantity),notes:"New sale",
                })});
              }catch(fulfillErr:any){
                // Reserve succeeded but fulfill failed (e.g. a concurrent sale) — undo the reserve.
                try{
                  await apiFetch(`/sales-orders/${order.id}/items/${item.id}/release`,{method:"POST",body:JSON.stringify({
                    storage_location_id:newSale.storage_location_id,quantity:Number(item.quantity),notes:"Auto-release after failed fulfill",
                  })});
                }catch{/* best effort */}
                throw fulfillErr;
              }
            }
          }catch(e:any){
            const actionVerb=newSale.stockAction==="reserve"?"reserved":"fulfilled";
            setError(`Sale order ${order.order_number} was created, but stock for "${item.item_name_snapshot}" could not be ${actionVerb}: ${e?.message||"stock update failed"}. Remaining lines were not processed — open the order to finish stock actions manually. No payment was recorded.`);
            setMode(null);
            await invalidate(queryClient,["sales","inventory","customers","dashboard"]);
            return;
          }
        }
      }

      let paymentNote="";
      if(amount>0){
        const grandTotal=Number(order.order_total)||total;
        const payment=await apiFetch<PaymentResult>("/payments",{method:"POST",body:JSON.stringify({
          direction:"incoming",transaction_type:"payment",
          payment_purpose:amount>=grandTotal?"full":"partial",
          customer_id:customerId,supplier_id:null,
          counterparty_name:order.customer_name||customerLabel||newSale.walkin_name||null,
          amount,currency_code:order.currency_code||"USD",
          payment_method:newSale.payment_method||null,status:"pending",
          transaction_reference:null,notes:`Payment for ${order.order_number}`,
          allocations:[{sales_order_id:order.id,purchase_order_id:null,shipment_id:null,container_id:null,
            amount,notes:`Applied to ${order.order_number}`}],
        })});
        if(isManager){
          await apiFetch(`/payments/${payment.id}/post`,{method:"POST"});
          paymentNote=" Payment posted.";
        }else{
          paymentNote=" Payment recorded as pending — a Manager/Admin must post it to update the balance.";
        }
      }else{
        paymentNote=" Recorded on credit — full balance is outstanding.";
      }

      const actionNote=newSale.stockAction==="draft"
        ?" Saved as a draft — no stock was reserved or deducted."
        :newSale.stockAction==="reserve"
        ?" Stock reserved — open the order and click Fulfill when ready."
        :"";
      setSuccess(`Sale ${order.order_number} ${newSale.stockAction==="fulfill"?"completed":"created"}.${actionNote}${paymentNote}`);
      setMode(null);
      await invalidate(queryClient,["sales","inventory","customers","payments","dashboard"]);
    }catch(e:any){setError(e?.message||"Unable to complete sale.");}
    finally{setNewSaleSaving(false);}
  }

  async function refreshSelected(orderId:string,extraGroups:Array<"inventory"|"customers"|"payments"|"dashboard">=[]){
    const d=await apiFetch<Order>(`/sales-orders/${orderId}`);
    setSelected(d);
    try{setStock(await apiFetch<StockStatus>(`/sales-orders/${orderId}/inventory`));}
    catch{setStock(null);}
    await invalidate(queryClient,["sales",...extraGroups]);
  }

  async function openOrder(order:Order,target:"view"|"edit"){
    setError("");
    try{
      const d=await apiFetch<Order>(`/sales-orders/${order.id}`);
      setSelected(d);
      setForm({
        customer_id:d.customer_id||"",sales_channel_id:d.sales_channel_id||"",order_status:d.order_status,
        shipping_amount:String(d.shipping_amount),order_discount:String(d.order_discount),notes:d.notes||"",
        item_id:"",quantity:"1",unit_price:"",
      });
      if(target==="view"){
        try{setStock(await apiFetch<StockStatus>(`/sales-orders/${order.id}/inventory`));}
        catch{setStock(null);}
      }
      setMode(target);
    }catch(e:any){setError(e?.message||"Unable to load order.");setMode(null);}
  }

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      if(mode==="create"){
        const line=form.item_id?[{
          item_id:form.item_id,quantity:Number(form.quantity),
          unit_price:numberOrNull(form.unit_price),discount_amount:0,tax_amount:0,notes:null,
        }]:[];
        await apiFetch("/sales-orders",{method:"POST",body:JSON.stringify({
          customer_id:form.customer_id||null,sales_channel_id:form.sales_channel_id||null,
          order_status:form.order_status,shipping_amount:Number(form.shipping_amount||0),
          order_discount:Number(form.order_discount||0),notes:form.notes||null,items:line,
        })});
        setSuccess("Sales order created successfully.");
      }else if(selected){
        await apiFetch(`/sales-orders/${selected.id}`,{method:"PUT",body:JSON.stringify({
          customer_id:form.customer_id||null,sales_channel_id:form.sales_channel_id||null,
          order_status:form.order_status,shipping_amount:Number(form.shipping_amount||0),
          order_discount:Number(form.order_discount||0),notes:form.notes||null,
        })});
        setSuccess("Sales order updated successfully.");
      }
      await invalidate(queryClient,["sales","dashboard"]);setMode(null);setSelected(null);
    }catch(e:any){setError(e?.message||"Unable to save sales order.");}
    finally{setSaving(false);}
  }

  async function cancel(order:Order){
    try{
      const status=await apiFetch<StockStatus>(`/sales-orders/${order.id}/inventory`);
      const hasReserved=status.items.some(x=>Number(x.reserved_quantity)>0);
      const hasFulfilled=status.items.some(x=>Number(x.fulfilled_quantity)>0);
      if(hasReserved){
        setError("Release this order's reserved stock before cancelling it.");
        return;
      }
      if(hasFulfilled){
        setError("This order already has fulfilled stock. Use the Return workflow before cancellation.");
        return;
      }
      if(!confirm(`Cancel ${order.order_number}?`))return;
      await apiFetch(`/sales-orders/${order.id}`,{method:"DELETE"});
      setSuccess("Sales order cancelled.");await invalidate(queryClient,["sales","dashboard"]);
    }catch(e:any){setError(e?.message||"Unable to cancel order.");}
  }

  async function addItem(){
    if(!selected)return;
    if(items.length===0){setError("No catalog items available.");return;}
    const menu=items.slice(0,50).map((i,n)=>`${n+1}. ${i.item_code} — ${i.name} (${Number(i.quantity_available)} available)`).join("\n");
    const n=Number(prompt(`Choose item number:\n${menu}`));
    if(!n||!items[n-1])return;
    const item=items[n-1];
    const qty=Number(prompt("Quantity","1")||0);
    const priceText=prompt("Unit price (leave blank to use default)",item.default_selling_price!=null?String(item.default_selling_price):"");
    try{
      await apiFetch(`/sales-orders/${selected.id}/items`,{method:"POST",body:JSON.stringify({
        item_id:item.id,quantity:qty,unit_price:priceText?Number(priceText):null,discount_amount:0,tax_amount:0,notes:null,
      })});
      await refreshSelected(selected.id);
    }catch(e:any){setError(e?.message||"Unable to add order item.");}
  }

  async function editItem(item:OrderItem){
    if(!selected)return;
    const qty=Number(prompt("Quantity",String(item.quantity))||0);
    const price=Number(prompt("Unit price",String(item.unit_price))||0);
    try{
      await apiFetch(`/sales-orders/${selected.id}/items/${item.id}`,{
        method:"PUT",body:JSON.stringify({quantity:qty,unit_price:price}),
      });
      await refreshSelected(selected.id);
    }catch(e:any){setError(e?.message||"Unable to edit order item.");}
  }

  async function removeItem(item:OrderItem){
    if(!selected||!confirm(`Remove ${item.item_name_snapshot}?`))return;
    try{
      await apiFetch(`/sales-orders/${selected.id}/items/${item.id}`,{method:"DELETE"});
      await refreshSelected(selected.id);
    }catch(e:any){setError(e?.message||"Unable to remove order item.");}
  }

  async function addFulfillment(){
    if(!selected)return;
    const carrier=prompt("Carrier","UPS");
    if(carrier===null)return;
    const tracking=prompt("Tracking number","");
    try{
      await apiFetch(`/sales-orders/${selected.id}/fulfillments`,{method:"POST",body:JSON.stringify({
        carrier:carrier||null,tracking_number:tracking||null,shipping_cost:null,status:"pending",notes:"Created from dashboard",
      })});
      await refreshSelected(selected.id);
    }catch(e:any){setError(e?.message||"Unable to add fulfillment.");}
  }

  async function updateFulfillment(f:Fulfillment){
    if(!selected)return;
    const st=prompt("Fulfillment status: pending, packed, shipped, delivered, returned, cancelled",f.status);
    if(!st)return;
    try{
      await apiFetch(`/sales-orders/${selected.id}/fulfillments/${f.id}`,{method:"PUT",body:JSON.stringify({status:st})});
      await refreshSelected(selected.id);
    }catch(e:any){setError(e?.message||"Unable to update fulfillment.");}
  }

  function beginStock(line:StockLine,action:StockAction){
    setStockForm({
      action,line_id:line.sales_order_item_id,item_name:line.item_name,
      storage_location_id:locations[0]?.id||"",
      quantity:action==="reserve"?String(line.remaining_to_fulfill):
        action==="fulfill"?String(line.reserved_quantity):
        action==="release"?String(line.reserved_quantity):String(line.fulfilled_quantity),
      unit_cost:"",notes:"",
    });
    setMode("stock");
  }

  async function saveStock(e:FormEvent){
    e.preventDefault();
    if(!selected)return;
    setSaving(true);setError("");
    try{
      const endpoint=`/sales-orders/${selected.id}/items/${stockForm.line_id}/${stockForm.action}`;
      const body:any={
        storage_location_id:stockForm.storage_location_id,
        quantity:Number(stockForm.quantity),
        notes:stockForm.notes||null,
      };
      if(stockForm.action==="return")body.unit_cost=stockForm.unit_cost?Number(stockForm.unit_cost):null;
      await apiFetch(endpoint,{method:"POST",body:JSON.stringify(body)});
      setSuccess(`${labelize(stockForm.action)} completed.`);
      await refreshSelected(selected.id,["inventory","dashboard"]);
      setMode("view");
    }catch(e:any){setError(e?.message||"Stock operation failed.");}
    finally{setSaving(false);}
  }

  function beginPayment(){
    if(!selected)return;
    setPaymentForm({
      amount:String(selected.balance_due),payment_method:"bank_transfer",reference:"",notes:"",
    });
    setMode("payment");
  }

  async function savePayment(e:FormEvent){
    e.preventDefault();
    if(!selected)return;
    const amount=Number(paymentForm.amount);
    if(!Number.isFinite(amount)||amount<=0){
      setError("Payment amount must be greater than zero.");
      return;
    }
    if(amount>Number(selected.balance_due)){
      setError("Payment cannot be greater than the current sales-order balance.");
      return;
    }
    setSaving(true);setError("");
    try{
      const payment=await apiFetch<PaymentResult>("/payments",{method:"POST",body:JSON.stringify({
        direction:"incoming",
        transaction_type:"payment",
        payment_purpose:amount>=Number(selected.balance_due)?"full":"partial",
        customer_id:selected.customer_id||null,
        supplier_id:null,
        counterparty_name:selected.customer_name||null,
        amount,
        currency_code:selected.currency_code||"USD",
        payment_method:paymentForm.payment_method||null,
        status:"pending",
        transaction_reference:paymentForm.reference||null,
        notes:paymentForm.notes||`Payment for ${selected.order_number}`,
        allocations:[{
          sales_order_id:selected.id,
          purchase_order_id:null,shipment_id:null,container_id:null,
          amount,
          notes:`Applied to ${selected.order_number}`,
        }],
      })});

      if(isManager){
        const postNow=confirm("Payment recorded as Pending. Post it now so the sales-order paid balance updates?");
        if(postNow){
          await apiFetch(`/payments/${payment.id}/post`,{method:"POST"});
          setSuccess("Payment recorded and posted. Sales balance updated.");
        }else{
          setSuccess("Payment recorded as Pending. Post it later from Payments.");
        }
      }else{
        setSuccess("Payment recorded as Pending. A Manager/Admin must post it before it affects the paid balance.");
      }

      await refreshSelected(selected.id,["payments","customers","dashboard"]);
      setMode("view");
    }catch(e:any){setError(e?.message||"Unable to record payment.");}
    finally{setSaving(false);}
  }

  const stockLineFor=(item:OrderItem)=>stock?.items.find(s=>s.sales_order_item_id===item.id);

  return <>
    <div className="page-header">
      <div><div className="eyebrow">Sales</div><h1 className="page-title">Sales Orders</h1>
        <p className="page-copy">Orders, customer payments, stock reservation, fulfillment and returns in one workflow.</p></div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
        <button className="btn btn-secondary" onClick={resetCreate}><Plus size={15}/>Draft Order</button>
        <button className="btn btn-primary" onClick={openNewSale}><WalletCards size={15}/>New Sale</button></div>
    </div>

    <Message error={error||(ordersQuery.isError?"Unable to load sales orders.":"")} success={success}/>

    <div className="card" style={{padding:12,marginBottom:14}}>
      <strong>Sales stock workflow:</strong>
      <span className="muted" style={{fontSize:12,marginLeft:7}}>
        Confirm order → Reserve stock → Record/Post payment as needed → Fulfill stock → create/update shipment fulfillment.
      </span>
    </div>

    <div className="records-toolbar card">
      <div><strong>All Sales Orders</strong><div className="muted" style={{fontSize:12}}>{orders.length} visible</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div className="records-search"><Search size={15}/><input placeholder="Order or customer..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select className="select" style={{width:170}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>{statuses.map(s=><option key={s} value={s}>{labelize(s)}</option>)}
        </select>
      </div>
    </div>

    <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Order Status</th><th>Payment</th><th>Actions</th></tr></thead>
      <tbody>{loading?<LoadingRow columns={9} text="Loading sales..."/>:orders.length===0?<EmptyRow columns={9}/>:orders.map(o=><tr key={o.id}>
        <td><strong>{o.order_number}</strong></td><td>{o.customer_name||"Walk-in / Unassigned"}</td><td>{o.order_date}</td>
        <td>{money(o.order_total,o.currency_code)}</td><td>{money(o.paid_amount,o.currency_code)}</td><td>{money(o.balance_due,o.currency_code)}</td>
        <td><StatusBadge value={o.order_status}/></td><td><StatusBadge value={o.payment_status}/></td>
        <td><div className="record-actions"><button className="record-action view" onClick={()=>openOrder(o,"view")}><Eye size={14}/></button>
          <button className="record-action edit" onClick={()=>openOrder(o,"edit")}><Pencil size={14}/></button>
          {isManager&&o.order_status!=="cancelled"&&<button className="record-action delete" onClick={()=>cancel(o)}><Trash2 size={14}/></button>}</div></td>
      </tr>)}</tbody></table></div>

    {mode==="newsale"&&<Modal title="New Sale" eyebrow="Sales" onClose={()=>setMode(null)} width={1120}>
      <form onSubmit={submitNewSale}>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button type="button" className={`btn ${newSale.customerMode==="walkin"?"btn-primary":"btn-secondary"}`}
            onClick={()=>setNewSale({...newSale,customerMode:"walkin"})}>Walk-in Customer</button>
          <button type="button" className={`btn ${newSale.customerMode==="existing"?"btn-primary":"btn-secondary"}`}
            onClick={()=>setNewSale({...newSale,customerMode:"existing"})}>Existing Customer</button>
        </div>

        <div className="form-grid">
          {newSale.customerMode==="walkin"?<>
            <Field label="Name (optional)" value={newSale.walkin_name} onChange={v=>setNewSale({...newSale,walkin_name:v})} placeholder="Walk-in customer name"/>
            <Field label="Phone (optional)" value={newSale.walkin_phone} onChange={v=>setNewSale({...newSale,walkin_phone:v})}/>
          </>:<SelectField label="Customer" value={newSale.customer_id} onChange={v=>setNewSale({...newSale,customer_id:v})} required
            options={[{value:"",label:"Select customer..."},...customers.map(c=>({value:c.id,label:c.company_name?`${c.name} — ${c.company_name}`:c.name}))]}/>}
          <SelectField label="Storage Location" value={newSale.storage_location_id} onChange={v=>setNewSale({...newSale,storage_location_id:v})} required={newSale.stockAction!=="draft"}
            options={[{value:"",label:"Select location..."},...locations.map(l=>({value:l.id,label:`${l.location_code}${l.name?` — ${l.name}`:""}`}))]}/>
          <SelectField label="Stock Action" value={newSale.stockAction} onChange={v=>setNewSale({...newSale,stockAction:v as NewSaleStockAction})}
            options={[
              {value:"draft",label:"Draft / No Stock Action"},
              {value:"reserve",label:"Reserve"},
              {value:"fulfill",label:"Fulfill Now"},
            ]}/>
        </div>
        <div className="muted" style={{fontSize:12,marginTop:-6,marginBottom:14}}>
          {newSale.stockAction==="draft"&&"Order only — inventory is untouched. Use for backorders or later processing."}
          {newSale.stockAction==="reserve"&&"Reserves the quantity at the selected location now. On Hand stays the same; Fulfill later from the order."}
          {newSale.stockAction==="fulfill"&&"Reserves and fulfills immediately — On Hand decreases now, no manual follow-up needed."}
        </div>

        <div className="panel-head" style={{marginTop:18}}><h3 style={{margin:0}}>Products</h3>
          <button type="button" className="btn btn-secondary" onClick={addLine}><Plus size={14}/>Add Line</button></div>
        <div className="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Line Total</th><th></th></tr></thead>
          <tbody>{newSale.lines.map((l,idx)=><tr key={idx}>
            <td style={{minWidth:220}}><select className="select" value={l.item_id} onChange={e=>{
              const item=items.find(i=>i.id===e.target.value);
              updateLine(idx,{item_id:e.target.value,unit_price:item?.default_selling_price!=null?String(item.default_selling_price):l.unit_price});
            }}>
              <option value="">Select item...</option>
              {items.map(i=><option key={i.id} value={i.id}>{i.item_code} — {i.name} ({Number(i.quantity_available)} avail)</option>)}
            </select></td>
            <td style={{width:90}}><input className="input" type="number" min="0.001" step="0.001" value={l.quantity} onChange={e=>updateLine(idx,{quantity:e.target.value})}/></td>
            <td style={{width:110}}><input className="input" type="number" min="0" step="0.01" value={l.unit_price} onChange={e=>updateLine(idx,{unit_price:e.target.value})}/></td>
            <td style={{width:110}}><input className="input" type="number" min="0" step="0.01" value={l.discount_amount} onChange={e=>updateLine(idx,{discount_amount:e.target.value})}/></td>
            <td>{money(lineTotal(l))}</td>
            <td>{newSale.lines.length>1&&<button type="button" className="record-action delete" onClick={()=>removeLine(idx)}><Trash2 size={14}/></button>}</td>
          </tr>)}</tbody>
        </table></div>

        <div className="panel-head" style={{marginTop:18}}><h3 style={{margin:0}}>Payment</h3><strong>Total: {money(newSaleTotal)}</strong></div>
        <div className="form-grid">
          <SelectField label="Payment" value={newSale.payment_type} onChange={v=>setNewSale({...newSale,payment_type:v as PaymentType,amount_paid:""})}
            options={[{value:"paid",label:"Paid in full"},{value:"partial",label:"Partial payment"},{value:"credit",label:"Credit (pay later)"}]}/>
          {newSale.payment_type==="partial"&&<Field label="Amount Received" type="number" min="0.01" step="0.01" value={newSale.amount_paid} onChange={v=>setNewSale({...newSale,amount_paid:v})} required/>}
          {newSale.payment_type!=="credit"&&<Field label="Payment Method" value={newSale.payment_method} onChange={v=>setNewSale({...newSale,payment_method:v})}/>}
          <TextAreaField label="Notes" value={newSale.notes} onChange={v=>setNewSale({...newSale,notes:v})}/>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
          <button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={newSaleSaving}>{newSaleSaving?<><Loader2 className="spin" size={15}/>Completing...</>:"Complete Sale"}</button>
        </div>
      </form>
    </Modal>}

    {(mode==="create"||mode==="edit")&&<Modal title={mode==="create"?"Create Sales Order":`Edit ${selected?.order_number||"Order"}`} eyebrow="Sales" onClose={()=>setMode(null)}>
      <form onSubmit={save}><div className="form-grid">
        <SelectField label="Customer" value={form.customer_id} onChange={v=>setForm({...form,customer_id:v})}
          options={[{value:"",label:"Walk-in / Unassigned"},...customers.map(c=>({value:c.id,label:c.company_name?`${c.name} — ${c.company_name}`:c.name}))]}/>
        <SelectField label="Sales Channel" value={form.sales_channel_id} onChange={v=>setForm({...form,sales_channel_id:v})}
          options={[{value:"",label:"No channel"},...channels.map(c=>({value:c.id,label:c.name}))]}/>
        <SelectField label="Status" value={form.order_status} onChange={v=>setForm({...form,order_status:v})}
          options={statuses.map(s=>({value:s,label:labelize(s)}))}/>
        <Field label="Shipping Amount" type="number" min="0" step="0.01" value={form.shipping_amount} onChange={v=>setForm({...form,shipping_amount:v})}/>
        <Field label="Order Discount" type="number" min="0" step="0.01" value={form.order_discount} onChange={v=>setForm({...form,order_discount:v})}/>
        {mode==="create"&&<>
          <SelectField label="First Item (optional)" value={form.item_id} onChange={v=>{
            const item=items.find(i=>i.id===v);
            setForm({...form,item_id:v,unit_price:item?.default_selling_price!=null?String(item.default_selling_price):""});
          }} options={[{value:"",label:"Create without line item"},...items.map(i=>({value:i.id,label:`${i.item_code} — ${i.name} (${Number(i.quantity_available)} available)`}))]}/>
          <Field label="Quantity" type="number" min="0.001" step="0.001" value={form.quantity} onChange={v=>setForm({...form,quantity:v})}/>
          <Field label="Unit Price" type="number" min="0" step="0.01" value={form.unit_price} onChange={v=>setForm({...form,unit_price:v})}/>
        </>}
        <TextAreaField label="Notes" value={form.notes} onChange={v=>setForm({...form,notes:v})}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Order"}</button>
      </div></form>
    </Modal>}

    {mode==="view"&&selected&&<Modal title={selected.order_number} eyebrow="Sales Order" onClose={()=>setMode(null)} width={1120}>
      <DetailGrid rows={[
        ["Customer",selected.customer_name||"Unassigned"],["Order Date",selected.order_date],
        ["Status",<StatusBadge value={selected.order_status}/>],["Channel",selected.sales_channel_name||"—"],
        ["Items Total",money(selected.items_total,selected.currency_code)],["Order Total",money(selected.order_total,selected.currency_code)],
        ["Paid",money(selected.paid_amount,selected.currency_code)],["Balance Due",money(selected.balance_due,selected.currency_code)],
        ["Payment Status",<StatusBadge value={selected.payment_status}/>],["Notes",selected.notes||"—"],
      ]}/>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:18}}>
        {Number(selected.balance_due)>0&&<button className="btn btn-primary" onClick={beginPayment}><WalletCards size={14}/>Record Payment</button>}
        {selected.order_status==="draft"&&<button className="btn btn-secondary" onClick={async()=>{
          try{await apiFetch(`/sales-orders/${selected.id}`,{method:"PUT",body:JSON.stringify({order_status:"confirmed"})});
            setSuccess("Order confirmed. You can now reserve stock.");await refreshSelected(selected.id);}
          catch(e:any){setError(e?.message||"Unable to confirm order.");}
        }}><PackageCheck size={14}/>Confirm Order</button>}
      </div>

      <div className="panel-head" style={{marginTop:22}}><div><h3 style={{margin:0}}>Order Items & Stock Workflow</h3>
        <div className="muted" style={{fontSize:12,marginTop:4}}>Reserve stock before fulfillment. Fulfillment deducts on-hand stock and creates a sale movement.</div></div>
        <button className="btn btn-secondary" onClick={addItem}><Plus size={14}/>Add Item</button></div>

      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Ordered</th><th>Reserved</th><th>Fulfilled</th><th>Remaining</th><th>Unit</th><th>Stock Actions</th><th>Edit</th></tr></thead>
        <tbody>{selected.items.length===0?<EmptyRow columns={8} text="No line items."/>:selected.items.map(i=>{
          const s=stockLineFor(i);
          return <tr key={i.id}><td>{i.item_code_snapshot} — {i.item_name_snapshot}</td><td>{Number(i.quantity)}</td>
            <td>{s?Number(s.reserved_quantity):"—"}</td><td>{s?Number(s.fulfilled_quantity):"—"}</td><td>{s?Number(s.remaining_to_fulfill):"—"}</td>
            <td>{money(i.unit_price,selected.currency_code)}</td>
            <td><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {selected.order_status!=="draft"&&s&&Number(s.remaining_to_fulfill)>Number(s.reserved_quantity)&&
                <button className="btn btn-ghost" onClick={()=>beginStock(s,"reserve")}><ArrowDownToLine size={12}/>Reserve</button>}
              {s&&Number(s.reserved_quantity)>0&&<>
                <button className="btn btn-ghost" onClick={()=>beginStock(s,"release")}><RotateCcw size={12}/>Release</button>
                <button className="btn btn-ghost" onClick={()=>beginStock(s,"fulfill")}><PackageCheck size={12}/>Fulfill</button>
              </>}
              {s&&Number(s.fulfilled_quantity)>0&&
                <button className="btn btn-ghost" onClick={()=>beginStock(s,"return")}><ArrowUpFromLine size={12}/>Return</button>}
            </div></td>
            <td><div className="record-actions">
              {(!s||(Number(s.reserved_quantity)===0&&Number(s.fulfilled_quantity)===0))&&<>
                <button className="record-action edit" onClick={()=>editItem(i)}><Pencil size={14}/></button>
                <button className="record-action delete" onClick={()=>removeItem(i)}><Trash2 size={14}/></button>
              </>}
            </div></td>
          </tr>;
        })}</tbody></table></div>

      <div className="panel-head" style={{marginTop:22}}><h3>Shipping Fulfillments</h3><button className="btn btn-secondary" onClick={addFulfillment}><Plus size={14}/>Add Fulfillment</button></div>
      {selected.fulfillments.length===0?<div className="muted">No shipment fulfillment records yet.</div>:<div style={{display:"grid",gap:8}}>
        {selected.fulfillments.map(f=><div className="card" style={{padding:12,display:"flex",justifyContent:"space-between",gap:12}} key={f.id}>
          <div><strong>{f.carrier||"Fulfillment"}</strong><div className="muted" style={{fontSize:12}}>{f.tracking_number||"No tracking"} · {labelize(f.status)}</div></div>
          <button className="btn btn-ghost" onClick={()=>updateFulfillment(f)}>Update</button>
        </div>)}
      </div>}
    </Modal>}

    {mode==="stock"&&selected&&<Modal title={`${labelize(stockForm.action)} — ${stockForm.item_name}`} eyebrow="Sales → Inventory" onClose={()=>setMode("view")}>
      <form onSubmit={saveStock}><div className="form-grid">
        <SelectField label="Storage Location" value={stockForm.storage_location_id} onChange={v=>setStockForm({...stockForm,storage_location_id:v})}
          required options={[{value:"",label:"Select location..."},...locations.map(l=>({value:l.id,label:`${l.location_code}${l.name?` — ${l.name}`:""}`}))]}/>
        <Field label="Quantity" type="number" min="0.001" step="0.001" value={stockForm.quantity} onChange={v=>setStockForm({...stockForm,quantity:v})} required/>
        {stockForm.action==="return"&&<Field label="Return Unit Cost (optional)" type="number" min="0" step="0.01" value={stockForm.unit_cost} onChange={v=>setStockForm({...stockForm,unit_cost:v})}/>}
        <TextAreaField label="Notes" value={stockForm.notes} onChange={v=>setStockForm({...stockForm,notes:v})}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button type="button" className="btn btn-secondary" onClick={()=>setMode("view")}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:`Confirm ${labelize(stockForm.action)}`}</button>
      </div></form>
    </Modal>}

    {mode==="payment"&&selected&&<Modal title={`Record Payment — ${selected.order_number}`} eyebrow="Finance" onClose={()=>setMode("view")}>
      <form onSubmit={savePayment}><div className="form-grid">
        <Field label="Amount" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={v=>setPaymentForm({...paymentForm,amount:v})} required/>
        <Field label="Payment Method" value={paymentForm.payment_method} onChange={v=>setPaymentForm({...paymentForm,payment_method:v})}/>
        <Field label="Reference" value={paymentForm.reference} onChange={v=>setPaymentForm({...paymentForm,reference:v})}/>
        <TextAreaField label="Notes" value={paymentForm.notes} onChange={v=>setPaymentForm({...paymentForm,notes:v})}/>
      </div>
      <div className="card" style={{padding:10,marginTop:12,fontSize:12}}>
        This creates an incoming financial transaction allocated to the sales order. Posted transactions update the paid/balance values.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button type="button" className="btn btn-secondary" onClick={()=>setMode("view")}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}><WalletCards size={14}/>Record Payment</button>
      </div></form>
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}

export default function Page() {
  return (
    <RequirePermission perm="sales.view">
      <SalesPage />
    </RequirePermission>
  );
}
