import {useState} from 'react';
import styles from './App.module.css';
import {ResumePanel} from '../components/ResumePanel';
import {JobsTable} from '../components/JobsTable';
export function App():React.JSX.Element{
 const [revision,setRevision]=useState(0);
 return <main className={styles.container}><header className={styles.header}><a className={styles.brand} href={import.meta.env.BASE_URL}>DevJob<span> Match AI</span></a><a href="#perfil">Meu currículo</a></header><JobsTable profileRevision={revision}/><details id="perfil"><summary>Meu currículo — enviar ou revisar</summary><ResumePanel onProfileChange={()=>setRevision(value=>value+1)}/></details><footer>Seu currículo permanece privado. Candidaturas são feitas no site da vaga.</footer></main>;
}
