'use client';
import React,{useId} from 'react';
export const terrainOptions=[['asphalt','Asfalto'],['trail','Caminos'],['treadmill','Cinta']];
export const painOptions=[['none','Sin molestias'],['mild','Leves'],['relevant','Relevantes / afectan la zancada']];
export const goalOptions=[['start','Empezar a correr','Construir el hábito desde cero'],['nonstop','Correr sin parar','Completar una distancia'],['time','Mejorar mi marca','5 km, 10 km, media o maratón'],['race','Preparar una carrera','Una fecha en el calendario'],['routine','Resistencia y rutina','Correr de forma constante'],['unknown','Aún no lo sé','Base cómoda y revisar la meta después']];
type ValueProps={label:string,value:string|number|null|undefined,onChange:(value:string)=>void};
type FieldProps=ValueProps&{hint?:React.ReactNode}&Omit<React.InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'>;
type SelectProps=ValueProps&{hint?:React.ReactNode,options:ReadonlyArray<ReadonlyArray<string|number>>};
type TextAreaProps=ValueProps&Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>,'value'|'onChange'>;
export function Field({label,value,onChange,hint,...props}:FieldProps){const key=useId();return <label className="field"><span id={key+'-label'}>{label}</span><input {...props} aria-labelledby={key+'-label'} aria-describedby={[props['aria-describedby'],hint?key+'-hint':null].filter(Boolean).join(' ')||undefined} value={value??''} onChange={e=>onChange(e.target.value)}/>{hint&&<small id={key+'-hint'}>{hint}</small>}</label>}
export function Select({label,value,onChange,options,hint}:SelectProps){const key=useId();return <label className="field"><span id={key+'-label'}>{label}</span><select aria-labelledby={key+'-label'} aria-describedby={hint?key+'-hint':undefined} value={value??''} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{hint&&<small id={key+'-hint'}>{hint}</small>}</label>}
export function TextArea({label,value,onChange,...props}:TextAreaProps){const key=useId();return <label className="field"><span id={key+'-label'}>{label}</span><textarea {...props} aria-labelledby={key+'-label'} rows={3} value={value??''} onChange={e=>onChange(e.target.value)}/></label>}
