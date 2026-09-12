import type {CSSProperties} from "react";
import "./percent-bars.css";
export function percentage(value:number,total:number){return total>0?value/total*100:0;}
export function PercentBars({values,vertical=false,unit="registros",labelPrefix=""}:{values:readonly (readonly [string,number|undefined])[];vertical?:boolean;unit?:string;labelPrefix?:string}) {
  const total=values.reduce((n,[,value])=>n+(value??0),0);
  const partial=values.some(([,value])=>value===undefined);
  return <div className="percent-chart"><p className="percent-chart-caption">{total.toLocaleString("es-CO")} {unit} {partial?"con datos disponibles":"en total"}. Cada barra = su parte de este total.</p><div className={`percent-bars${vertical?" percent-bars--vertical":""}`}>
    {values.map(([name,value])=>{const pct=percentage(value??0,total);const formatted=total>0&&value!==undefined?`${pct.toLocaleString("es-CO",{maximumFractionDigits:1})}%`:"—";return <div className="percent-bar" key={name} style={{"--share":`${pct}%`,"--bar-color":pct>=50?"#23804f":pct>=25?"#248b87":"#588aaa"} as CSSProperties}><div className="percent-bar-heading"><span>{name}</span><strong>{value?.toLocaleString("es-CO")??"Sin dato"}</strong></div><div className="percent-bar-track" role="meter" aria-label={`${labelPrefix}${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${value??"Sin dato"} ${unit}; ${formatted} del total`}><div className="percent-bar-fill"/><span className="percent-bar-percent">{formatted}</span></div></div>;})}
    {!values.length&&<p>Sin datos para mostrar.</p>}
    </div><small className="percent-chart-legend">Color según participación: azul &lt;25% · turquesa 25–49,9% · verde ≥50%. No indica cumplimiento.{total===0?" Sin total positivo no se calcula porcentaje.":""}{partial?" Total parcial: hay categorías sin datos.":""}</small></div>;
}
