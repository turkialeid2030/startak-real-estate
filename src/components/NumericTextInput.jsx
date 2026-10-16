import React from 'react';
import {parseNumericText} from '../validation/numeric-text';

export default function NumericTextInput({value,onChange,percentage=false,locale,warning,...props}){
  const format=v=>typeof v==='number'&&Number.isFinite(v)?String(percentage?Number((v*100).toFixed(4)):v):String(v??'');
  const [raw,setRaw]=React.useState(()=>format(value));
  const sent=React.useRef(value),id=React.useId();
  React.useEffect(()=>{if(!Object.is(sent.current,value)){setRaw(format(value));sent.current=value;}},[value,percentage]);
  const parsed=parseNumericText(raw),invalid=!parsed.ok;
  return <>
    <input {...props} type="text" inputMode="decimal" value={raw} aria-invalid={invalid||warning?'true':undefined} aria-describedby={invalid?id:undefined} onChange={e=>{
      if(props.disabled)return;
      const text=e.target.value,result=parseNumericText(text);
      // Invalid text remains visible and reaches engine validation, so a prior
      // valid result cannot masquerade as the result of this new input.
      const next=result.ok?(percentage?result.value/100:result.value):text;
      setRaw(text);sent.current=next;onChange(next);
    }}/>
    {invalid&&<p id={id} role="alert" data-numeric-error className="mt-1 text-xs text-rose-300">{locale==='en'?'Invalid number. Use Arabic or English digits, one decimal separator, and correctly grouped thousands; scientific notation and other text are not accepted.':'رقم غير صالح. استخدم أرقامًا عربية أو إنجليزية وفاصلة عشرية واحدة، وفواصل آلاف صحيحة. الصيغة العلمية والنصوص الأخرى غير مقبولة.'} <code dir="ltr">{parsed.code}</code></p>}
  </>;
}
