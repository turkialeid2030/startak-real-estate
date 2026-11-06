"""Independent synthetic D05 reference. Standard library only; no STARTAK imports."""
import calendar, datetime, json, math
from decimal import Decimal as D, ROUND_HALF_UP, getcontext
from pathlib import Path
getcontext().prec=50
CENT=D('0.01')
def money(v):return D(v).quantize(CENT,rounding=ROUND_HALF_UP)
def parts(value,count):
 cents=int(money(value)*100);q,r=divmod(abs(cents),count);sign=-1 if cents<0 else 1
 return [D(sign*(q+(i<r)))/100 for i in range(count)]
def date_at(offset):
 y,m=divmod(2026*12+offset,12);m+=1
 return datetime.date(y,m,min(31,calendar.monthrange(y,m)[1]))
def add(book,offset,value):
 key=date_at(offset).isoformat();book[key]=book.get(key,D(0))+value

def solve(flows):
 vals=[v for _,v in flows if v]
 if not vals or not any(v<0 for v in vals) or not any(v>0 for v in vals):return None
 changes=sum(a*b<0 for a,b in zip(vals,vals[1:]))
 if changes>1:return None
 origin=datetime.date.fromisoformat(flows[0][0]);terms=[((datetime.date.fromisoformat(t)-origin).days/365.2425,float(v)) for t,v in flows]
 def npv(rate):return sum(v/(1+rate)**t for t,v in terms)
 lo,hi=-.9999,100
 for _ in range(300):
  mid=(lo+hi)/2
  if npv(mid)*npv(lo)>0:lo=mid
  else:hi=mid
 return (lo+hi)/2

def make(name,rate='0',timing='UNIFORM_MONTHLY',financed=True,tenor=12,grace=0,balloon='0',operations=1):
 r=D(rate)/12;land=D(100000);cost=D(100000);noi=D(360000);exit_value=D(3600000)
 fraction=D('.5') if financed else D(0)
 land_debt=money(land*fraction);draws=parts(cost*fraction,30);costs=parts(cost,30)
 balance=land_debt;capitalized=D(0);construction=[];p={};e={}
 add(p,0,-land);add(e,0,-land+land_debt)
 for i,(c,d) in enumerate(zip(costs,draws)):
  balance+=d;interest=money(balance*r);balance+=interest;capitalized+=interest
  add(p,i,-c);add(e,i,-c+d)
  construction.append({'drawDate':date_at(i).isoformat(),'capitalizationDate':date_at(i+1).isoformat(),'cost':float(c),'draw':float(d),'interest':float(interest),'balance':float(balance)})
 completion=balance;target=money(completion*D(balloon));debt=[]
 if balance:
  for month in range(1,grace+1):
   interest=money(balance*r);balance+=interest
   debt.append({'month':month,'payment':0.,'balance':float(balance)})
  count=tenor-grace
  payment=money((balance-target/(1+r)**count)*r/(1-(1+r)**(-count))) if r else money((balance-target)/count)
  for month in range(grace+1,tenor+1):
   interest=money(balance*r);principal=min(max(D(0),payment-interest),max(D(0),balance-target));balance-=principal
   paid=payment if month<tenor else interest+principal+balance
   if month==tenor:balance=D(0)
   debt.append({'month':month,'payment':float(paid),'balance':float(balance)})
 for month in range(1,operations*12+1):
  income=noi/12 if timing=='UNIFORM_MONTHLY' else noi if month%12==0 else D(0)
  if income:add(p,30+month,income);add(e,30+month,income)
 for row in debt[:operations*12]:add(e,30+row['month'],-D(str(row['payment'])))
 remaining=D(str(debt[min(operations*12,len(debt))-1]['balance'])) if debt else D(0)
 add(p,30+operations*12,exit_value);add(e,30+operations*12,exit_value-remaining)
 pf,ef=sorted(p.items()),sorted(e.items())
 def metric(flows):
  origin=datetime.date.fromisoformat(flows[0][0]);npv=sum(float(v)/(1.1)**((datetime.date.fromisoformat(t)-origin).days/365.2425) for t,v in flows)
  irr=solve(flows)
  return {'npv':round(npv,2),'irr':None if irr is None else round(irr,10),'cashflows':[{'date':t,'amount':float(v)} for t,v in flows]}
 return {'name':name,'rate':float(D(rate)),'timing':timing,'financed':financed,'tenorYears':tenor/12,'operatingYears':operations,'grace':grace,'balloon':float(D(balloon)),
  'completionDebt':float(completion),'capitalizedInterest':float(capitalized),'remainingDebt':float(remaining),
  'construction':construction,'debt':debt[:operations*12],'project':metric(pf),'equity':metric(ef)}
rows=[make('zero_rate_monthly'),make('interest_monthly','0.06'),make('interest_annual','0.06','ANNUAL_END'),
 make('unlevered_monthly','0.06',financed=False),make('debt_remaining_at_exit','0.06',tenor=36),
 make('capitalized_grace_balloon','0.06',grace=3,balloon='0.2'),make('annual_multiple_sign_changes','0.06','ANNUAL_END',tenor=36,operations=2)]
Path(__file__).with_name('D05-monthly-reference.json').write_text(json.dumps({'basis':'Independent Decimal halala schedule; ACT/365.2425; synthetic amounts only','cases':rows},indent=2)+'\n')
