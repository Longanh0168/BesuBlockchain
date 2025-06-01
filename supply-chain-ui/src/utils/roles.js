export const ROLE_OPTIONS = [
  { value: "PRODUCER_ROLE", label: "Producer" },
  { value: "TRANSPORTER_ROLE", label: "Transporter" },
  { value: "DISTRIBUTOR_ROLE", label: "Distributor" },
  { value: "RETAILER_ROLE", label: "Retailer" },
  { value: "CUSTOMER_ROLE", label: "Customer" },
  { value: "DEFAULT_ADMIN_ROLE", label: "Admin" },
];

export const ADDRESS_TO_NAME_MAP = {
  "0xa586c054754e674141b3e1067dd6163baae59417": "Administrator",
  "0x8eb326f586acf3010744ad3b2e83ce55d2f6cb54": "Producer",
  "0xe83f7ea2eb8d5049d9162b1f2cfc9075a1c698d0": "Transporter",
  "0xbe85127318076116cf4c19c5dd91c95503368ffe": "Distributor",
  "0xb85a94bb5d2f97d1cd517b7ec6208b869c4b2444": "Retailer",
  "0xaafd5d06eab12321852413ffe3a06233c33e8a66": "Customer",
};

export const NAME_TO_ADDRESS_MAP = Object.entries(ADDRESS_TO_NAME_MAP).reduce((acc, [address, name]) => {
  acc[name.toUpperCase()] = address; 
  return acc;
}, {});

// Hàm tiện ích để lấy tên từ địa chỉ
export const getNameByAddress = (address) => {
  if (!address) return "N/A";
  return ADDRESS_TO_NAME_MAP[address.toLowerCase()] || address;
};

// Hàm tiện ích để lấy địa chỉ từ tên
export const getAddressByName = (name) => {
  if (!name) return "0x0000000000000000000000000000000000000000";
  return NAME_TO_ADDRESS_MAP[name.toUpperCase()] || "0x0000000000000000000000000000000000000000";
};
