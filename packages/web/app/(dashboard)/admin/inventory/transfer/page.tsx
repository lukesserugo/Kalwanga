// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\transfer\page.tsx

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Truck, Package, Search, X,
  Warehouse, Building, Loader2, AlertCircle,
  ArrowRight, Lock, Info, MapPin, Minus, Plus,
  CheckCircle, Building2
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService } from '../../../../../services/inventoryService';
import { productService, Product as ServiceProduct } from '../../../../../services/productService';
import { companyService } from '../../../../../services/companyService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  barcode?: string | null;
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
}

interface Inventory {
  id: string;
  productId: string;
  quantity: number;
  reserved: number;
  location: string;
  available?: number;
  reorderPoint?: number;
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive?: boolean;
}

interface TransferFormData {
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes: string;
}

// ============================================
// LOCATION OPTIONS - Real locations from database
// ============================================

const DEFAULT_LOCATIONS = [
  'Warehouse',
  'Storefront',
  'Backroom',
  'Distribution Center',
  'Retail Store',
  'Online Store',
  'Supplier',
  'In Transit'
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function TransferPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  // Refs to prevent duplicate requests
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef(false);
  const businessUnitsLoadedRef = useRef(false);
  
  // State
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [searching, setSearching] = useState(false);
  const [formData, setFormData] = useState<TransferFormData>({
    fromLocation: '',
    toLocation: '',
    quantity: 1,
    notes: '',
  });
  
  // Business units
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>('');
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  
  // Locations from database
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Permission checks
  const canTransferInventory = 
    hasPermission(`${PermissionResource.INVENTORY}:create`) ||
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    hasPermission(`${PermissionResource.INVENTORY}:transfer`);

  // ============================================
  // FETCH BUSINESS UNITS
  // ============================================

  const fetchBusinessUnits = useCallback(async () => {
    if (businessUnitsLoadedRef.current) return;
    
    setLoadingBusinessUnits(true);
    try {
      console.log('📤 Fetching business units from database...');
      console.log('📤 Method 1: Fetching from /business-units...');
      
      // Try fetching from /business-units endpoint
      let units: BusinessUnit[] = [];
      
      try {
        // Try the direct business units endpoint
        const response = await fetch('http://localhost:3001/business-units', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📥 Business units response:', data);
          
          // Handle different response formats
          let businessUnitsData = data;
          if (data.data && Array.isArray(data.data)) {
            businessUnitsData = data.data;
          } else if (data.businessUnits && Array.isArray(data.businessUnits)) {
            businessUnitsData = data.businessUnits;
          } else if (Array.isArray(data)) {
            businessUnitsData = data;
          }
          
          if (Array.isArray(businessUnitsData) && businessUnitsData.length > 0) {
            units = businessUnitsData
              .filter((bu: any) => bu.id && bu.id !== 'default' && bu.id !== 'default-business-unit')
              .map((bu: any) => ({
                id: bu.id,
                name: bu.name || 'Unnamed Business Unit',
                code: bu.code || '',
                type: bu.type || 'STORE',
                isActive: bu.isActive !== false,
              }));
          }
        }
      } catch (error) {
        console.warn('Failed to fetch from /business-units:', error);
      }

      // If no units from direct endpoint, try from companies
      if (units.length === 0) {
        try {
          const response = await companyService.getAll({ limit: 100 });
          if (response?.data && Array.isArray(response.data)) {
            const allUnits: BusinessUnit[] = [];
            for (const company of response.data) {
              if (company.businessUnits && Array.isArray(company.businessUnits)) {
                company.businessUnits.forEach((bu: any) => {
                  if (bu.id && bu.id !== 'default' && bu.id !== 'default-business-unit') {
                    allUnits.push({
                      id: bu.id,
                      name: bu.name || 'Unnamed Business Unit',
                      code: bu.code || '',
                      type: bu.type || 'STORE',
                      isActive: bu.isActive !== false,
                    });
                  }
                });
              }
            }
            units = allUnits;
          }
        } catch (error) {
          console.warn('Failed to fetch from companies:', error);
        }
      }

      // If still no units, try from user context
      if (units.length === 0 && user) {
        const userAny = user as any;
        if (userAny?.businessUnits && Array.isArray(userAny.businessUnits)) {
          units = userAny.businessUnits
            .map((bu: any) => {
              const id = bu.businessUnitId || bu.id;
              if (!id || id === 'default' || id === 'default-business-unit') return null;
              return {
                id: id,
                name: bu.businessUnit?.name || bu.name || 'Unnamed Business Unit',
                code: bu.businessUnit?.code || bu.code || '',
                type: bu.businessUnit?.type || bu.type || 'STORE',
                isActive: bu.businessUnit?.isActive !== undefined ? bu.businessUnit.isActive : true,
              };
            })
            .filter((bu: BusinessUnit | null): bu is BusinessUnit => bu !== null);
        }
      }

      // Fallback to saved ID
      if (units.length === 0) {
        const savedId = localStorage.getItem('businessUnitId');
        if (savedId && savedId !== 'default' && savedId !== 'default-business-unit') {
          units.push({
            id: savedId,
            name: 'Default Business Unit',
            code: 'DEFAULT',
            type: 'STORE',
            isActive: true,
          });
        }
      }

      console.log('📊 Parsed data type:', units.length > 0 ? 'Array' : 'Empty');
      console.log(`✅ Fetched ${units.length} business units`);
      
      setBusinessUnits(units);

      // Auto-select business unit
      if (units.length > 0) {
        const savedId = localStorage.getItem('selectedBusinessUnitId') || localStorage.getItem('businessUnitId');
        if (savedId) {
          const saved = units.find(bu => bu.id === savedId && bu.isActive !== false);
          if (saved) {
            console.log(`✅ Auto-selected business unit: ${saved.id} ${saved.name}`);
            setSelectedBusinessUnitId(saved.id);
            // Fetch locations for this business unit
            fetchLocations(saved.id);
            businessUnitsLoadedRef.current = true;
            setLoadingBusinessUnits(false);
            return;
          }
        }
        const active = units.find(bu => bu.isActive !== false);
        if (active) {
          console.log(`✅ Auto-selected business unit: ${active.id} ${active.name}`);
          setSelectedBusinessUnitId(active.id);
          localStorage.setItem('businessUnitId', active.id);
          // Fetch locations for this business unit
          fetchLocations(active.id);
        }
      }

      businessUnitsLoadedRef.current = true;
      
    } catch (error) {
      console.error('Failed to fetch business units:', error);
      // Try to use saved ID as fallback
      const savedId = localStorage.getItem('businessUnitId');
      if (savedId && savedId !== 'default' && savedId !== 'default-business-unit') {
        setSelectedBusinessUnitId(savedId);
      }
    } finally {
      setLoadingBusinessUnits(false);
    }
  }, [user]);

  // ============================================
  // FETCH LOCATIONS
  // ============================================

  const fetchLocations = useCallback(async (businessUnitId: string) => {
    if (!businessUnitId || businessUnitId === 'default' || businessUnitId === 'default-business-unit') {
      setLocations(DEFAULT_LOCATIONS);
      return;
    }

    setLoadingLocations(true);
    try {
      console.log(`📤 Loading options with businessUnitId: ${businessUnitId}`);
      
      // Try to get locations from inventory items
      let locationList: string[] = [];
      
      try {
        console.log('📤 Attempt 1: Fetching locations from inventory...');
        const inventoryData = await inventoryService.getAllInventory(businessUnitId);
        console.log('📥 getInventory response:', inventoryData);
        
        // ✅ FIX: Handle the correct response structure - { items: any[], stats: InventoryStats }
        if (inventoryData && typeof inventoryData === 'object') {
          // ✅ FIX: Use 'items' property directly, not 'data'
          if (inventoryData.items && Array.isArray(inventoryData.items)) {
            const uniqueLocations = new Set<string>();
            inventoryData.items.forEach((item: any) => {
              if (item.location) {
                uniqueLocations.add(item.location);
              }
            });
            locationList = Array.from(uniqueLocations);
            console.log(`📍 Found ${locationList.length} unique locations from inventory`);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch locations from inventory:', error);
      }

      // If no locations from inventory, try from products
      if (locationList.length === 0) {
        try {
          console.log('📤 Attempt 2: Fetching locations from products...');
          const products = await productService.getAllProducts({ 
            limit: 50, 
            businessUnitId 
          });
          if (products && typeof products === 'object') {
            let productList: any[] = [];
            if (Array.isArray(products)) {
              productList = products;
            } else if (products.data && Array.isArray(products.data)) {
              productList = products.data;
            }
            
            const uniqueLocations = new Set<string>();
            productList.forEach((p: any) => {
              if (p.location) {
                uniqueLocations.add(p.location);
              }
            });
            locationList = Array.from(uniqueLocations);
            console.log(`📍 Found ${locationList.length} unique locations from products`);
          }
        } catch (error) {
          console.warn('Failed to fetch locations from products:', error);
        }
      }

      // Use DEFAULT_LOCATIONS if no locations found
      if (locationList.length === 0) {
        console.log('📤 Using default locations');
        locationList = DEFAULT_LOCATIONS;
      }

      console.log(`✅ Locations loaded: ${locationList.length}`);
      setLocations(locationList);
      
    } catch (error) {
      console.warn('Failed to fetch locations:', error);
      setLocations(DEFAULT_LOCATIONS);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  // ============================================
  // SEARCH PRODUCTS
  // ============================================

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSearchResults([]);
    
    if (query.length < 2) return;
    
    // Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        console.log(`🔍 Searching for: ${query}`);
        // Use productService to search
        const results = await productService.getAllProducts({ 
          search: query, 
          limit: 10,
          businessUnitId: selectedBusinessUnitId || undefined,
        });
        
        let products: Product[] = [];
        if (results && typeof results === 'object') {
          let productList: ServiceProduct[] = [];
          if (Array.isArray(results)) {
            productList = results;
          } else if (results.data && Array.isArray(results.data)) {
            productList = results.data;
          }
          
          products = productList.map((p: ServiceProduct) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unitPrice: p.unitPrice || 0,
            barcode: p.barcode || null,
            category: p.category ? { id: p.category.id, name: p.category.name } : null,
            supplier: p.supplier ? { id: p.supplier.id, name: p.supplier.name } : null,
          }));
        }
        
        console.log(`🔍 Found ${products.length} products`);
        setSearchResults(products);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [selectedBusinessUnitId]);

  // ============================================
  // SELECT PRODUCT
  // ============================================

  const handleSelectProduct = useCallback(async (product: Product) => {
    if (!selectedBusinessUnitId || selectedBusinessUnitId === 'default' || selectedBusinessUnitId === 'default-business-unit') {
      toast.error('Please select a business unit first');
      return;
    }

    setSelectedProduct(product);
    setSearchQuery('');
    setSearchResults([]);
    
    try {
      console.log(`📤 Getting inventory for product: ${product.id}`);
      // Get inventory for the product
      const inv = await inventoryService.getInventoryByProduct(product.id, selectedBusinessUnitId);
      console.log('📥 Inventory response:', inv);
      
      if (inv) {
        const mappedInventory: Inventory = {
          id: inv.id || '',
          productId: inv.productId || product.id,
          quantity: inv.quantity || inv.stock || 0,
          reserved: inv.reserved || 0,
          location: inv.location || 'Warehouse',
          available: (inv.quantity || inv.stock || 0) - (inv.reserved || 0),
          reorderPoint: inv.reorderPoint || 5,
        };
        setInventory(mappedInventory);
        if (mappedInventory.location) {
          setFormData(prev => ({ ...prev, fromLocation: mappedInventory.location || '' }));
        }
        toast.success(`Product ${product.name} loaded successfully`);
      } else {
        // Product not in inventory
        setInventory(null);
        toast.warning('Product not found in inventory');
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
      setInventory(null);
      toast.warning('Could not load inventory for this product');
    }
  }, [selectedBusinessUnitId]);

  // ============================================
  // SUBMIT TRANSFER
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    
    if (!selectedBusinessUnitId || selectedBusinessUnitId === 'default' || selectedBusinessUnitId === 'default-business-unit') {
      toast.error('Please select a valid business unit');
      return;
    }
    
    if (!formData.fromLocation || !formData.toLocation) {
      toast.error('Please specify both locations');
      return;
    }
    
    if (formData.fromLocation === formData.toLocation) {
      toast.error('Source and destination must be different');
      return;
    }
    
    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    
    const availableStock = inventory ? (inventory.available || inventory.quantity) : 0;
    if (formData.quantity > availableStock) {
      toast.error(`Not enough stock. Available: ${availableStock}`);
      return;
    }

    setLoading(true);
    try {
      await inventoryService.transferStock({
        productId: selectedProduct.id,
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        quantity: formData.quantity,
        notes: formData.notes || undefined,
        businessUnitId: selectedBusinessUnitId,
      });
      
      toast.success('Stock transferred successfully');
      router.push('/admin/inventory');
      router.refresh();
    } catch (error: any) {
      console.error('Transfer failed:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to transfer stock';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CLEAR SELECTION
  // ============================================

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setInventory(null);
    setSearchQuery('');
    setSearchResults([]);
    setFormData({
      fromLocation: '',
      toLocation: '',
      quantity: 1,
      notes: '',
    });
  };

  // ============================================
  // LOCATION CHANGE
  // ============================================

  const handleLocationChange = (field: 'fromLocation' | 'toLocation', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ============================================
  // BUSINESS UNIT SELECT
  // ============================================

  const handleBusinessUnitSelect = (businessUnitId: string) => {
    const selected = businessUnits.find(bu => bu.id === businessUnitId);
    if (selected && selected.isActive !== false) {
      setSelectedBusinessUnitId(businessUnitId);
      localStorage.setItem('selectedBusinessUnitId', businessUnitId);
      localStorage.setItem('businessUnitId', businessUnitId);
      toast.success(`Switched to ${selected.name}`);
      // Clear selected product when switching business units
      handleClearSelection();
      // Fetch locations for the new business unit
      fetchLocations(businessUnitId);
    } else if (selected && selected.isActive === false) {
      toast.error('This business unit is inactive');
    } else {
      toast.error('Invalid business unit selected');
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  // Fetch business units on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchBusinessUnits();
    }
  }, [isAuthenticated, fetchBusinessUnits]);

  // Fetch locations when business unit changes
  useEffect(() => {
    if (selectedBusinessUnitId && selectedBusinessUnitId !== 'default' && selectedBusinessUnitId !== 'default-business-unit') {
      fetchLocations(selectedBusinessUnitId);
    }
  }, [selectedBusinessUnitId, fetchLocations]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderSearchResults = () => {
    if (searching) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Searching...</p>
        </div>
      );
    }

    if (searchResults.length === 0 && searchQuery.length >= 2) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-4 text-center">
          <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No products found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Try a different search term</p>
        </div>
      );
    }

    if (searchResults.length > 0 && !selectedProduct) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
          {searchResults.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelectProduct(product)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</p>
                {product.category && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">{product.category.name}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(product.unitPrice)}
                </span>
              </div>
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!canTransferInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to transfer stock.</p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const availableStock = inventory ? (inventory.available || inventory.quantity) : 0;
  const selectedBU = businessUnits.find(bu => bu.id === selectedBusinessUnitId);

  if (loadingBusinessUnits) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading business units...</p>
        </div>
      </div>
    );
  }

  if (businessUnits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">No Business Units</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Please create a business unit first.</p>
          <button
            onClick={() => router.push('/admin/settings')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-500" />
              Transfer Stock
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Move inventory between locations</p>
          </div>
        </div>
        {selectedBU && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm text-green-700 dark:text-green-300">
            <Building2 className="w-4 h-4" />
            <span>{selectedBU.name}</span>
          </div>
        )}
      </div>

      {/* BUSINESS UNIT SELECTOR */}
      {businessUnits.length > 1 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Business Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedBusinessUnitId}
            onChange={(e) => handleBusinessUnitSelect(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name} {bu.code ? `(${bu.code})` : ''} {bu.isActive === false ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* FORM */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      >
        {/* PRODUCT SELECTION */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Product <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  disabled={loading || !!selectedProduct || !selectedBusinessUnitId || selectedBusinessUnitId === 'default'}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                  aria-label="Clear selection"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {renderSearchResults()}
            </AnimatePresence>
          </div>

          {/* Selected Product Display */}
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    {selectedProduct.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {selectedProduct.sku}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Price: {formatCurrency(selectedProduct.unitPrice)}
                  </p>
                  {selectedProduct.category && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Category: {selectedProduct.category.name}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Available Stock</p>
                  <p className={`text-lg font-bold ${
                    availableStock === 0 ? 'text-red-600 dark:text-red-400' :
                    availableStock <= (inventory?.reorderPoint || 5) ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {availableStock}
                  </p>
                </div>
              </div>
              {inventory && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="w-3 h-3" />
                  <span>Current Location: {inventory.location || 'Warehouse'}</span>
                  {inventory.reserved > 0 && (
                    <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                      ({inventory.reserved} reserved)
                    </span>
                  )}
                  {inventory.reorderPoint && (
                    <span className="ml-2 text-gray-400">
                      Reorder Point: {inventory.reorderPoint}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {!selectedBusinessUnitId || selectedBusinessUnitId === 'default' ? (
            <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Please select a business unit first
            </p>
          ) : null}
        </div>

        {/* LOCATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Location <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.fromLocation}
                onChange={(e) => handleLocationChange('fromLocation', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter source location"
                list="locationList"
                required
                disabled={loading || loadingLocations}
              />
              <datalist id="locationList">
                {locations.map(loc => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>
            {loadingLocations && (
              <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading locations...
              </p>
            )}
            {inventory && inventory.location && formData.fromLocation !== inventory.location && (
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Current location is "{inventory.location}"
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Location <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.toLocation}
                onChange={(e) => handleLocationChange('toLocation', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter destination location"
                list="locationList"
                required
                disabled={loading || loadingLocations}
              />
            </div>
            {formData.fromLocation && formData.toLocation && formData.fromLocation === formData.toLocation && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Source and destination must be different
              </p>
            )}
          </div>
        </div>

        {/* QUANTITY */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quantity to Transfer <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
              min="1"
              max={availableStock || 0}
              className="w-32 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
              disabled={loading || !selectedProduct}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                disabled={loading || !selectedProduct || formData.quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[20px] text-center">
                {formData.quantity}
              </span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, quantity: Math.min(availableStock || 1, prev.quantity + 1) }))}
                className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                disabled={loading || !selectedProduct || formData.quantity >= availableStock}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {inventory && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Max: {availableStock}
              </span>
            )}
          </div>
          {inventory && formData.quantity > availableStock && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-4 h-4" />
              Not enough stock available. Available: {availableStock}
            </motion.p>
          )}
        </div>

        {/* NOTES */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-y"
            placeholder="Reason for transfer..."
            disabled={loading}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Stock will be deducted from source and added to destination</span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-1 sm:flex-none"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading || 
                !selectedProduct || 
                !selectedBusinessUnitId ||
                selectedBusinessUnitId === 'default' ||
                formData.quantity <= 0 || 
                formData.fromLocation === formData.toLocation || 
                formData.quantity > availableStock
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-1 sm:flex-none transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Transfer Stock
                </>
              )}
            </button>
          </div>
        </div>

        {/* FORM FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
          <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              selectedProduct && selectedBusinessUnitId && selectedBusinessUnitId !== 'default' ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            {selectedProduct ? 'Product selected' : 'Select a product to transfer'}
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle className={`w-3 h-3 ${selectedBusinessUnitId && selectedBusinessUnitId !== 'default' ? 'text-green-500' : 'text-gray-400'}`} />
            {selectedBusinessUnitId && selectedBusinessUnitId !== 'default' ? 'Business unit selected' : 'Select business unit'}
          </span>
          <span>
            {locations.length} location{locations.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </motion.form>
    </div>
  );
}
