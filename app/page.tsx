import Runner from './runner';
import {requireChatGPTUser} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <Runner account={{name:user.displayName,email:user.email}}/>;}
