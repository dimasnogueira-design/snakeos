'use client';
import {useEffect} from 'react';
export default function RegisterWorker(){useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);return null;}
