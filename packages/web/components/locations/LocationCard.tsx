'use client';

// packages/web/components/locations/LocationCard.tsx

import React from 'react';
import {
  MapPin,
  Star,
  Edit,
  Trash2,
  Package,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import {
  LOCATION_TYPE_LABELS,
  type Location,
} from '../../services/locationService';

interface LocationCardProps {
  location: Location;
  /** Optional BU name — when provided, replaces the generic "BU" chip. */
  businessUnitName?: string;
  inventoryCount?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (location: Location) => void;
  onDelete?: (location: Location) => void;
  onView?: (location: Location) => void;
}

export function LocationCard({
  location,
  businessUnitName,
  inventoryCount = 0,
  canEdit = true,
  canDelete = true,
  onEdit,
  onDelete,
  onView,
}: LocationCardProps) {
  // ✅ Human-readable label from the same map used by LocationForm and LocationsPage.
  // Falls back to the raw enum if a new type hasn't been labelled yet.
  const typeLabel = location.type
    ? LOCATION_TYPE_LABELS[location.type] ?? location.type
    : 'Other';

  const isActive = location.isActive !== false;

  return (
    <div
      className={`card-brand shadow-soft transition duration-250 ${
        onView
          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-card-hover focus-ring'
          : ''
      }`}
      onClick={() => onView?.(location)}
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      aria-label={onView ? `View ${location.name}` : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Icon tile — matches the brand accent used elsewhere */}
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Name + chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-semibold text-gray-900 dark:text-white truncate"
                title={location.name}
              >
                {location.name}
              </h3>

              {location.isDefault && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                  <Star className="w-3 h-3" />
                  Default
                </span>
              )}

              {/* ✅ Show both states with matching chip shapes so the
                  header row stays balanced whichever state it's in. */}
              {isActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  Inactive
                </span>
              )}
            </div>

            {/* Type + code — primary metadata, text-sm */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {typeLabel}
              {location.code && (
                <span className="ml-2 font-mono tabular-nums text-2xs text-gray-500 dark:text-gray-400">
                  ({location.code})
                </span>
              )}
            </p>

            {/* Address — secondary metadata, text-xs, truncated with tooltip */}
            {location.address && (
              <p
                className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate"
                title={location.address}
              >
                {location.address}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(location);
              }}
              className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-xl transition duration-250 focus-ring"
              title="Edit"
              aria-label={`Edit ${location.name}`}
            >
              <Edit className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(location);
              }}
              className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-xl transition duration-250 focus-ring"
              title="Delete"
              aria-label={`Delete ${location.name}`}
            >
              <Trash2 className="w-4 h-4 text-danger-500" />
            </button>
          )}
        </div>
      </div>

      {/* Footer — inventory count + optional BU name */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Package className="w-3.5 h-3.5" />
          <span className="tabular-nums">
            {inventoryCount} item{inventoryCount !== 1 ? 's' : ''}
          </span>
        </span>

        {/*
          ✅ Only render the BU chip when we actually have a name to show.
          Previously this showed a bare "BU" which carried no information.
        */}
        {businessUnitName && (
          <span
            className="flex items-center gap-1 text-gray-400 dark:text-gray-500 truncate max-w-[50%]"
            title={businessUnitName}
          >
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{businessUnitName}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default LocationCard;
