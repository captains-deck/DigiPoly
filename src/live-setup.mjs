import {CloudClient} from './cloud.mjs';
if(new URLSearchParams(location.search).has('signin')){
  try{const me=await new CloudClient().me();document.getElementById('identity').textContent=`Signed in as ${me.email}. You can return to DigiPoly Live.`;}
  catch(error){document.getElementById('identity').textContent=error.message;}
}
