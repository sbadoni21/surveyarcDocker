// components/tickets/TagMultiSelect.jsx
"use client";
import { useState, useEffect } from "react";
import {
  Autocomplete,
  TextField,
  Chip,
  Box,
  Typography,
  CircularProgress,
  createFilterOptions
} from "@mui/material";
import { LocalOffer } from "@mui/icons-material";

const filter = createFilterOptions();

const TagMultiSelect = ({ 
  orgId, 
  value = [], 
  onChange, 
  label = "Tags",
  placeholder = "Select or search tags...",
  disabled = false 
}) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Fetch available tags for the organization
  useEffect(() => {
    if (!orgId) return;
    
    const fetchTags = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/post-gres-apis/tags?org_id=${orgId}`);
        if (response.ok) {
          const tagData = await response.json();
          setTags(tagData || []);
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [orgId]);

  // Get currently selected tag objects
  const selectedTags = tags.filter(tag => value.includes(tag.tag_id));

  const handleChange = (event, newValue) => {
    // Extract tag_ids from selected tags
    const tagIds = newValue.map(tag => tag.tag_id);
    onChange(tagIds);
  };

  return (
    <Autocomplete
      multiple
      options={tags}
      value={selectedTags}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
      getOptionLabel={(option) => option.name || option.tag_id}
      isOptionEqualToValue={(option, value) => option.tag_id === value.tag_id}
      loading={loading}
      disabled={disabled}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);
        return filtered;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <LocalOffer
            sx={{ 
              color: option.color || '#808080', 
              mr: 1, 
              fontSize: 16 
            }}
          />
          <Box>
            <Typography variant="body2">
              {option.name}
            </Typography>
            {option.category && (
              <Typography variant="caption" color="text.secondary">
                {option.category}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option.tag_id}
            label={option.name}
            size="small"
            icon={<LocalOffer sx={{ color: option.color || '#808080' }} />}
            style={{
              backgroundColor: option.color ? `${option.color}20` : undefined,
              borderColor: option.color || '#808080',
            }}
            variant="outlined"
          />
        ))
      }
      ChipProps={{
        size: "small",
        variant: "outlined"
      }}
    />
  );
};

export default TagMultiSelect;
