const BASE = "/api/post-gres-apis/pricing"; // Next.js route proxying to FastAPI /pricing

const toJson = async (res) => {
   console.log("latest respose",res)
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json().catch(() => ({}));
};

const pricingPlanModel = {
  async getAll() {
    const res = await fetch(BASE, { cache: "no-store" });
    console.log(res)
    return toJson(res); 
  },

  async findById(id) {
    const res = await fetch(`${BASE}/${id}`, { cache: "no-store" });
    return toJson(res); // returns { id, name, price, amount, features }
  },
};

export default pricingPlanModel;
