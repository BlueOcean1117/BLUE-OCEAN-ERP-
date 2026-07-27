import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: false,
});
API.interceptors.request.use((config) => {
   const token = localStorage.getItem("erp_token");
   if (token) {
     config.headers.Authorization = `Bearer ${token}`;
   }
   return config;
 });


export default API;
