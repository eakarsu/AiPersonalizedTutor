const jwt=require('jsonwebtoken');
const pool=require('../config/database');

async function authenticateToken(req,res,next){
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer '))return res.status(401).json({error:'AUTHENTICATION_REQUIRED'});
  try{
    const payload=jwt.verify(header.slice(7),process.env.JWT_SECRET);
    const actorId=String(payload.id||payload.sub||'');
    const result=await pool.query('SELECT id FROM users WHERE id::text=$1 LIMIT 1',[actorId]);
    if(!result.rows[0])return res.status(401).json({error:'IDENTITY_NOT_ACTIVE'});
    req.user={id:String(result.rows[0].id)};
    next();
  }catch(_error){return res.status(401).json({error:'INVALID_OR_EXPIRED_TOKEN'});}
}

module.exports={authenticateToken};
