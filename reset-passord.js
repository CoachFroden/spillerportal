import { auth } from "./firebase.js";
import { verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get("oobCode");

function showError(text){
  $("checkingState").hidden=true;
  $("resetForm").hidden=true;
  $("successState").hidden=true;
  $("errorText").textContent=text||"Lenken er ugyldig eller har utløpt.";
  $("errorState").hidden=false;
}

function maskEmail(email){
  const [name,domain]=String(email||"").split("@");
  if(!name||!domain)return email||"kontoen din";
  const visible=name.length<=2?name[0]:(name.slice(0,2));
  return visible+"•••@"+domain;
}

async function init(){
  if(!code)return showError("Denne lenken mangler nødvendig sikkerhetskode.");
  try{
    const email=await verifyPasswordResetCode(auth,code);
    $("resetAccount").textContent="Nytt passord for "+maskEmail(email);
    $("checkingState").hidden=true;
    $("resetForm").hidden=false;
    $("newPassword").focus();
  }catch(error){
    console.error("verify reset code",error);
    showError(error?.code==="auth/expired-action-code"
      ?"Denne lenken har utløpt. Be om en ny lenke fra innloggingssiden."
      :"Denne lenken er ugyldig eller allerede brukt. Be om en ny lenke fra innloggingssiden.");
  }
}

document.querySelectorAll(".showPassword").forEach(button=>{
  button.addEventListener("click",()=>{
    const input=$(button.dataset.target);
    if(!input)return;
    const show=input.type==="password";
    input.type=show?"text":"password";
    button.textContent=show?"🙈":"👁";
    button.setAttribute("aria-label",show?"Skjul passord":"Vis passord");
  });
});

$("resetForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const password=$("newPassword").value;
  const confirm=$("confirmPassword").value;
  const message=$("resetMessage");
  const button=$("savePassword");

  message.textContent="";
  if(password.length<6){
    message.textContent="Passordet må ha minst 6 tegn.";
    $("newPassword").focus();
    return;
  }
  if(password!==confirm){
    message.textContent="Passordene er ikke like.";
    $("confirmPassword").focus();
    return;
  }

  button.disabled=true;
  button.textContent="Lagrer …";
  try{
    await confirmPasswordReset(auth,code,password);
    $("resetForm").hidden=true;
    $("successState").hidden=false;
  }catch(error){
    console.error("confirm password reset",error);
    if(error?.code==="auth/expired-action-code"||error?.code==="auth/invalid-action-code"){
      showError("Lenken er ikke lenger gyldig. Be om en ny lenke fra innloggingssiden.");
      return;
    }
    message.textContent="Kunne ikke lagre det nye passordet. Prøv igjen.";
  }finally{
    button.disabled=false;
    button.textContent="Lagre nytt passord";
  }
});

init();
