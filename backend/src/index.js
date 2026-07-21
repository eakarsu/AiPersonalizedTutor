const express=require('express');
const cors=require('cors');
const path=require('path');
require('dotenv').config({path:path.join(__dirname,'../../.env')});
const governanceRouter=require('../governance/router');
const {validateRuntime}=require('../governance/runtime');
const {createProviderGate}=require('../governance/providerGate');

validateRuntime();
const app=express();
const port=Number(process.env.BACKEND_PORT);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('BACKEND_PORT must be an assigned TCP port.');
const origins=String(process.env.CORS_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean);
if(!origins.length||origins.includes('*'))throw new Error('CORS_ORIGINS must be an explicit allowlist.');
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
app.use(cors({origin:(origin,callback)=>!origin||origins.includes(origin)?callback(null,true):callback(new Error('Origin not allowed by CORS')),credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use(createProviderGate(['/api/ai','/api/gap','/api/generated','/api/lms','/api/canvas','/api/blackboard','/api/grade']));
app.get('/api/health',(_req,res)=>res.json({status:'ok',workflow:'approved_learning_intervention',humanEducatorRequired:true,timestamp:new Date().toISOString()}));
app.use('/api/auth',require('./routes/auth'));
app.use('/api/governance',governanceRouter);
app.use((_req,res)=>res.status(404).json({error:'ROUTE_NOT_SUPPORTED'}));
app.use((error,_req,res,_next)=>{console.error('Request failed:',error.message);res.status(500).json({error:'INTERNAL_SERVER_ERROR'});});
app.listen(port,()=>console.log(`Governed personalized-tutor API listening on ${port}`));

module.exports=app;
