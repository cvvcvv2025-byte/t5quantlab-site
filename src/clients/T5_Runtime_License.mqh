// T5 runtime license client v1 candidate. Native MetaEditor acceptance required.
// Include AFTER defining T5_LICENSE_PRODUCT. Never put a service-side secret here.
#ifndef T5_RUNTIME_LICENSE_INCLUDED
#define T5_RUNTIME_LICENSE_INCLUDED
input string InpT5LicenseKey = "";
string t5LicenseState="WAITING_FOR_ONLINE_CHECK";
uint t5LeaseTick=0,t5LeaseSeconds=0,t5AttemptTick=0;
datetime t5LeaseLocal=0;
bool t5Attempted=false;
string t5LeaseLogin="",t5LeaseServer="";

string T5AccountLogin()
{
#ifdef __MQL5__
   return IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
#else
   return IntegerToString(AccountNumber());
#endif
}
string T5AccountServer()
{
#ifdef __MQL5__
   return AccountInfoString(ACCOUNT_SERVER);
#else
   return AccountServer();
#endif
}
string T5Platform()
{
#ifdef __MQL5__
   return "MT5";
#else
   return "MT4";
#endif
}
bool T5IsTester()
{
   return (bool)MQLInfoInteger(MQL_TESTER);
}
void T5LicenseStatus(string state)
{
   if(t5LicenseState!=state) Print("T5 license: ",state,". Existing position management remains active.");
   t5LicenseState=state;
}
void T5LicenseDeny(string state)
{
   t5LeaseSeconds=0;
   T5LicenseStatus(state);
}
bool T5LicenseAllowsNewEntry()
{
   // The Strategy Tester cannot use WebRequest. This bypass exists only in
   // tester execution, never in demo/live terminals.
   if(T5IsTester()) return true;
   if(t5LeaseSeconds==0) return false;
   if(T5AccountLogin()!=t5LeaseLogin || T5AccountServer()!=t5LeaseServer)
   { T5LicenseDeny("ACCOUNT_CHANGED");return false; }
   // Unsigned 32-bit subtraction handles the GetTickCount rollover within our
   // maximum 24-hour lease. A local clock rollback does not extend validity.
   uint elapsed=(uint)(GetTickCount()-t5LeaseTick);
   if(elapsed/1000>=t5LeaseSeconds || TimeLocal()<t5LeaseLocal-5 || TimeLocal()>=t5LeaseLocal+(int)t5LeaseSeconds)
   { T5LicenseDeny("EXPIRED_OR_OFFLINE_LIMIT");return false; }
   return true;
}
string T5JsonEscape(string value)
{
   StringReplace(value,"\\","\\\\");StringReplace(value,"\"","\\\"");
   return value;
}
bool T5Decimal(string value)
{
   if(StringLen(value)<1 || StringLen(value)>12) return false;
   for(int i=0;i<StringLen(value);i++) { ushort c=StringGetCharacter(value,i);if(c<48 || c>57)return false; }
   return true;
}
void T5LicenseRefresh()
{
   if(T5IsTester()) { T5LicenseStatus("STRATEGY_TESTER_ONLY");return; }
   uint tick=GetTickCount();
   bool changed=t5LeaseSeconds>0 && (T5AccountLogin()!=t5LeaseLogin || T5AccountServer()!=t5LeaseServer);
   if(changed) { T5LicenseDeny("ACCOUNT_CHANGED");t5Attempted=false; }
   if(t5Attempted && (uint)(tick-t5AttemptTick)<300000) return;
   t5AttemptTick=tick;t5Attempted=true;
   if(StringLen(InpT5LicenseKey)!=64) { T5LicenseDeny("ENTER_LICENSE_KEY");return; }
   string login=T5AccountLogin(),server=T5AccountServer();
   if(login=="0" || server=="") { T5LicenseDeny("WAITING_FOR_TRADING_ACCOUNT");t5Attempted=false;return; }
   // Nonce correlates the TLS response with this request; it is not an auth key.
   string nonce=StringFormat("%08x%08x%08x%08x",GetTickCount(),(uint)GetMicrosecondCount(),(uint)TimeLocal(),(uint)MathRand());
   string body="{\"product_code\":\""+T5_LICENSE_PRODUCT+"\",\"platform\":\""+T5Platform()+"\",\"account_login\":\""+login+"\",\"broker_server\":\""+T5JsonEscape(server)+"\",\"nonce\":\""+nonce+"\"}";
   char data[],result[];StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);ArrayResize(data,ArraySize(data)-1);
   string headers="Content-Type: application/json\r\nAccept: text/plain\r\nAuthorization: Bearer "+InpT5LicenseKey+"\r\n",responseHeaders;
   // Called only from OnTimer, not from an order/position management callback.
   // WebRequest is synchronous even on the timer, so cap blocking at one second.
   int code=WebRequest("POST","https://t5quantlab.com/api/licenses/verify",headers,1000,data,result,responseHeaders);
   if(code==401 || code==403 || code==409) { T5LicenseDeny("AUTHORIZATION_DENIED");return; }
   if(code!=200) { T5LicenseStatus(T5LicenseAllowsNewEntry()?"OFFLINE_GRACE":"ONLINE_CHECK_REQUIRED");return; }
   string fields[];int count=StringSplit(CharArrayToString(result,0,-1,CP_UTF8),StringGetCharacter("|",0),fields);
   if(count!=9 || fields[0]!="T5L1" || fields[1]!=nonce || fields[2]!=T5_LICENSE_PRODUCT || fields[3]!=T5Platform() || fields[4]!=login || fields[8]!="active" || !T5Decimal(fields[5]) || !T5Decimal(fields[6]) || !T5Decimal(fields[7]))
   { T5LicenseDeny("INVALID_SERVER_RESPONSE");return; }
   long issued=StringToInteger(fields[5]),expiry=StringToInteger(fields[6]),lease=StringToInteger(fields[7]);
   if(issued<=0 || lease<=issued || lease-issued>86400 || (expiry>0 && lease>expiry) || login!=T5AccountLogin() || server!=T5AccountServer())
   { T5LicenseDeny("INVALID_OR_EXPIRED_LEASE");return; }
   if(lease-issued<=2) { T5LicenseDeny("LEASE_TOO_CLOSE_TO_EXPIRY");return; }
   // Deduct the bounded request time plus rounding; receiving the response must
   // not accidentally extend authorization past its server-side expiry.
   t5LeaseTick=GetTickCount();t5LeaseLocal=TimeLocal();t5LeaseSeconds=(uint)(lease-issued-2);
   t5LeaseLogin=login;t5LeaseServer=server;T5LicenseStatus("ACTIVE");
}
void T5LicenseStart()
{
   // Starting/restarting an EA always requires a fresh online check. No editable
   // plaintext file or terminal GlobalVariable is accepted as a license proof.
   t5LeaseSeconds=0;t5Attempted=false;
   if(!EventSetTimer(10)) Print("T5 license timer unavailable. New entries remain disabled.");
}
void T5LicenseStop() { EventKillTimer(); }
#endif
