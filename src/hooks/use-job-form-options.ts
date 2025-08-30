import * as React from 'react';

/**
 * Custom hook for managing job form select options and auto-population mappings
 * @param isOpen - Whether the form is open (triggers data fetching)
 * @returns Select options, mappings, and loading state
 */
export function useJobFormOptions(isOpen: boolean) {
  // Dynamic select options state
  const [customerOptions, setCustomerOptions] = React.useState<string[]>([]);
  const [billToOptions, setBillToOptions] = React.useState<string[]>([]);
  const [registrationOptions, setRegistrationOptions] = React.useState<string[]>([]);
  const [truckTypeOptions, setTruckTypeOptions] = React.useState<string[]>([]);
  const [driverOptions, setDriverOptions] = React.useState<string[]>([]);
  const [selectsLoading, setSelectsLoading] = React.useState(true);
  
  // Auto-population mappings
  const [customerToBillTo, setCustomerToBillTo] = React.useState<Record<string, string>>({});
  const [registrationToType, setRegistrationToType] = React.useState<Record<string, string>>({});
  const [driverToTruck, setDriverToTruck] = React.useState<Record<string, string>>({});

  // Fetch options for dynamic selects and mappings
  React.useEffect(() => {
    if (!isOpen) return;

    const fetchOptions = async () => {
      try {
        setSelectsLoading(true);
        const [customerResponse, vehicleResponse, driverResponse, customerMappingResponse, vehicleMappingResponse, driverMappingResponse] = await Promise.all([
          fetch('/api/customers/select-options'),
          fetch('/api/vehicles/select-options'),
          fetch('/api/drivers/select-options'),
          fetch('/api/customers/mappings'),
          fetch('/api/vehicles/mappings'),
          fetch('/api/drivers/mappings')
        ]);

        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          setCustomerOptions(customerData.customerOptions || []);
          setBillToOptions(customerData.billToOptions || []);
        }

        if (vehicleResponse.ok) {
          const vehicleData = await vehicleResponse.json();
          setRegistrationOptions(vehicleData.registrationOptions || []);
          setTruckTypeOptions(vehicleData.truckTypeOptions || []);
        }

        if (driverResponse.ok) {
          const driverData = await driverResponse.json();
          setDriverOptions(driverData.driverOptions || []);
        }

        if (customerMappingResponse.ok) {
          const customerMappingData = await customerMappingResponse.json();
          setCustomerToBillTo(customerMappingData.customerToBillTo || {});
        }

        if (vehicleMappingResponse.ok) {
          const vehicleMappingData = await vehicleMappingResponse.json();
          setRegistrationToType(vehicleMappingData.registrationToType || {});
        }

        if (driverMappingResponse.ok) {
          const driverMappingData = await driverMappingResponse.json();
          setDriverToTruck(driverMappingData.driverToTruck || {});
        }
      } catch (error) {
        console.error('Error fetching form options:', error);
      } finally {
        setSelectsLoading(false);
      }
    };

    fetchOptions();
  }, [isOpen]);

  return {
    // Options
    customerOptions,
    billToOptions,
    registrationOptions,
    truckTypeOptions,
    driverOptions,
    selectsLoading,
    
    // Mappings
    customerToBillTo,
    registrationToType,
    driverToTruck
  };
}