"use client";
import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TableSortLabel } from "@mui/material";
import { useSurvey } from "@/providers/surveyPProvider";
import { useQuestion } from "@/providers/questionPProvider";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import MenuItem from "@mui/material/MenuItem";
import SurveyFormComponent from "@/components/SurveyFormComponent";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Box,
  IconButton,
  Typography,
  InputAdornment,
  Button,
  Menu,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import SurveyResponsePopup from "@/components/SurveyResponsePopup";
import { FiPlus } from "react-icons/fi";
import { Icon } from "@iconify/react";
import { FaSpinner } from "react-icons/fa";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { TemplateSelectionPopup } from "@/components/surveys/TemplateSelectionPopup";
import { createSurveyFromTemplate } from "@/utils/createSurveyFromTemplate";
import { format, formatDistanceToNow } from "date-fns";

export default function SurveyPage() {
  const [name, setName] = useState("");
  const [time, setTime] = useState("10 min");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [orderBy, setOrderBy] = useState("name");
  const [order, setOrder] = useState("asc");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(6);
  
  // Template-related states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const [surveyNameForTemplate, setSurveyNameForTemplate] = useState("");

  const { user, uid } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const projectId = pathParts[6];
  const [isEditing, setIsEditing] = useState(false);
  const [editSurveyId, setEditSurveyId] = useState(null);

  const {
    surveys,
    getAllSurveys,
    surveyLoading,
    saveSurvey,
    updateSurvey,
    deleteSurvey: deleteSurveyContext,
    listResponses,
    countResponses,
  } = useSurvey();

  const { saveQuestion } = useQuestion();
console.log(surveys)
  const [surveysWithCounts, setSurveysWithCounts] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);
  const [responseData, setResponseData] = useState([]);
  const [openPopup, setOpenPopup] = useState(false);

  // Fetch all surveys
  useEffect(() => {
    if (!orgId || !projectId) return;
    getAllSurveys(orgId, projectId);
  }, [orgId, projectId]);

  // Count responses
  useEffect(() => {
    const fetchCounts = async () => {
      if (!surveys?.length) {
        setSurveysWithCounts([]);
        return;
      }
      const updated = await Promise.all(
        surveys.map(async (s) => {
          try {
            const { count } = await countResponses(s.survey_id || s.surveyId || s.id);
            return { ...s, surveyId: s.survey_id || s.surveyId || s.id, responseCount: count || 0 };
          } catch {
            return { ...s, surveyId: s.survey_id || s.surveyId || s.id, responseCount: 0 };
          }
        })
      );
      setSurveysWithCounts(updated);
    };
    fetchCounts();
  }, [surveys]);


  const openMenuFor = (event, surveyId) => {
    setAnchorEl(event.currentTarget);
    setSelectedSurveyId(surveyId);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    setSelectedSurveyId(null);
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const filteredAndSortedSurveys = useMemo(() => {
    let filtered = surveysWithCounts.filter(
      (survey) =>
        survey.name.toLowerCase().includes(searchText.toLowerCase()) ||
        survey.time.toLowerCase().includes(searchText.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (order === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [surveysWithCounts, searchText, orderBy, order]);

  const paginatedSurveys = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredAndSortedSurveys.slice(startIndex, endIndex);
  }, [filteredAndSortedSurveys, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  const handleClick = (surveyId) => {
    router.push(`/postgres-org/${orgId}/dashboard/projects/${projectId}/${surveyId}`);
  };

  // Handle creating survey from scratch
  const handleCreateFromScratch = async () => {
    if (!surveyNameForTemplate.trim()) {
      alert("Please enter a survey name");
      return;
    }

    setLoading(true);
    try {
      const surveyData = {
        name: surveyNameForTemplate,
        time: "10 min",
        orgId,
        projectId,
        createdBy: uid,
        status: "draft",
      };
      
      const newSurvey = await saveSurvey(surveyData);
      
      setSurveyNameForTemplate("");
      setShowCreateDialog(false);
      
      // Navigate to the new survey
      if (newSurvey?.survey_id || newSurvey?.surveyId) {
        router.push(`/postgres-org/${orgId}/dashboard/projects/${projectId}/${newSurvey.survey_id || newSurvey.surveyId}`);
      }
      
      alert("Survey created successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to create survey");
    } finally {
      setLoading(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = async (template) => {
    if (!template) {
      // User chose "Start Blank" from template popup
      handleCreateFromScratch();
      return;
    }
console.log(surveyNameForTemplate)
    if (!surveyNameForTemplate.trim()) {

      alert("Please enter a survey name");
      return;
    }

    setLoading(true);
    try {
      const result = await createSurveyFromTemplate(
        template,

        orgId,
        projectId,
        uid,
        { create: saveSurvey, update: updateSurvey },
        { create: saveQuestion },
              surveyNameForTemplate,  // Pass the name here

      );

      // Update the survey name
      if (result?.survey_id) {
        await updateSurvey(orgId, result.survey_id, {
          name: surveyNameForTemplate,
        });
      }

      setSurveyNameForTemplate("");
      setShowTemplatePopup(false);
      setShowCreateDialog(false);

      // Navigate to the new survey
      if (result?.survey_id) {
        router.push(`/postgres-org/${orgId}/dashboard/projects/${projectId}/${result.survey_id}`);
      }

      alert(`Survey "${surveyNameForTemplate}" created from template successfully!`);
    } catch (error) {
      console.error("Failed to create survey:", error);
      alert("Failed to create survey from template");
    } finally {
      setLoading(false);
    }
  };

  // Open create dialog
  const handleOpenCreateDialog = () => {
    setSurveyNameForTemplate("");
    setShowCreateDialog(true);
  };

  // Open template selection
  const handleUseTemplate = () => {
    if (!surveyNameForTemplate.trim()) {
      alert("Please enter a survey name first");
      return;
    }
    setShowCreateDialog(false);
    setShowTemplatePopup(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return alert("Please enter a survey name");
    if (!time.trim()) return alert("Please enter survey duration");
    setLoading(true);
    try {
      if (isEditing && editSurveyId) {
        await updateSurvey(orgId, editSurveyId, {
          name,
          time,
          updatedBy: uid,
        });
        alert("Survey updated!");
      } else {
        const surveyData = {
          name,
          time,
          orgId,
          projectId,
          createdBy: uid,
        };
        await saveSurvey(surveyData);
      }

      setName("");
      setTime("10 min");
      setIsEditing(false);
      setEditSurveyId(null);
      setShowForm(false);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setTime("10 min");
    setIsEditing(false);
    setEditSurveyId(null);
    setShowForm(false);
  };

  const deleteSurvey = async (id) => {
    if (window.confirm("Are you sure you want to delete this survey?")) {
      setLoading(true);
      try {
        await deleteSurveyContext(orgId, id);
        setSurveysWithCounts((prev) => prev.filter((s) => s.surveyId !== id));
      } catch (error) {
        console.error(error);
        alert("Error deleting survey");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (survey) => {
    setName(survey.name);
    setTime(survey.time);
    setIsEditing(true);
    setEditSurveyId(survey.surveyId);
    setShowForm(true);
  };

  const clearSearch = () => {
    setSearchText("");
  };

  return (
    <div
      className="mx-auto px-4 py-6 min-h-screen transition-colors duration-300 dark:bg-black"
      style={{
        color: "var(--text-primary)",
      }}
    >
      <header className="mb-8">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <h1 className="text-2xl font-semibold text-black dark:text-[#CBC9DE]">
            Surveys <br />
            <span className="text-base font-normal text-[#5B596A]">
              Project: {projectId}
            </span>
          </h1>

          <div className="flex flex-1 items-center justify-end gap-4 flex-wrap sm:flex-nowrap">
            <div className="w-full sm:w-[80%]">
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search surveys by name or duration..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                    backgroundColor: isDarkMode ? "#1A1A1E" : "#ffffff",
                    color: isDarkMode ? "#CBC9DE" : "#000000",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: isDarkMode ? "#2e2e32" : "#e0e0e0",
                  },
                  "& .MuiInputAdornment-root, & .MuiSvgIcon-root": {
                    color: isDarkMode ? "#5B596A" : "#757575",
                  },
                  input: {
                    color: isDarkMode ? "#CBC9DE" : "#000000",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchText && (
                    <InputAdornment position="end">
                      <IconButton onClick={clearSearch} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </div>

            <Button
              variant="contained"
              onClick={handleOpenCreateDialog}
              className="whitespace-nowrap"
              size="large"
              sx={{
                height: "54px",
                backgroundColor: "var(--primary)",
                color: "#ffffff",
                fontWeight: 600,
                borderRadius: "8px",
                textTransform: "none",
                paddingX: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                "&:hover": {
                  backgroundColor: "var(--primary-hover)",
                },
              }}
            >
              <FiPlus className="text-2xl" />
              Create Survey
            </Button>
          </div>
        </div>
      </header>

      {/* Create Survey Dialog */}
      <Dialog 
        open={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Create New Survey
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Survey Name"
              variant="outlined"
              value={surveyNameForTemplate}
              onChange={(e) => setSurveyNameForTemplate(e.target.value)}
              placeholder="Enter survey name..."
              autoFocus
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Choose how you want to start your survey
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setShowCreateDialog(false)}
            variant="outlined"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateFromScratch}
            variant="outlined"
            disabled={loading || !surveyNameForTemplate.trim()}
          >
            {loading ? <FaSpinner className="animate-spin" /> : "Start from Scratch"}
          </Button>
          <Button
            onClick={handleUseTemplate}
            variant="contained"
            disabled={loading || !surveyNameForTemplate.trim()}
            sx={{
              backgroundColor: "var(--primary)",
              "&:hover": {
                backgroundColor: "var(--primary-hover)",
              },
            }}
          >
            {loading ? <FaSpinner className="animate-spin" /> : "Use Template"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Selection Popup */}
      <TemplateSelectionPopup
        isOpen={showTemplatePopup}
        onClose={() => {
          setShowTemplatePopup(false);
          setShowCreateDialog(true); // Go back to create dialog
        }}
        onSelectTemplate={handleSelectTemplate}
        orgId={orgId}
        projectId={projectId}
          name={surveyNameForTemplate}   // ADD THIS

      />

      <SurveyFormComponent
        show={showForm}
        name={name}
        time={time}
        setName={setName}
        setTime={setTime}
        loading={loading}
        isEditing={isEditing}
        handleSubmit={handleSubmit}
        handleCancel={handleCancel}
      />

      {surveyLoading ? (
        <div className="flex justify-center items-center py-12">
          <FaSpinner className="animate-spin text-orange-500 dark:text-amber-300 text-4xl" />
        </div>
      ) : surveysWithCounts?.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: "center",
            backgroundColor: isDarkMode ? "#1A1A1E" : "#ffffff",
            borderRadius: "12px",
          }}
        >
          <Typography variant="h6" sx={{ color: "#CBC9DE", mb: 1 }}>
            No surveys added yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "#96949C" }}>
            Click the "Create Survey" button to get started.
          </Typography>
        </Paper>
      ) : (
        <Paper
          elevation={0}
          sx={{
            backgroundColor: isDarkMode ? "#1A1A1E" : "#ffffff",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <TableContainer
            sx={{
              backgroundColor: isDarkMode ? "#1A1A1E" : "#ffffff",
              borderRadius: 2,
              p: 1,
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  {[
                    { key: "name", label: "Survey Name" },
                    { key: "survey_id", label: "Survey ID" },
                    { key: "status", label: "Status" },
                    { key: "updated_at", label: "Last modified" },
                    { key: "actions", label: "Actions" },
                  ].map((col, idx) => (
                    <TableCell
                      key={col.key}
                      sx={{
                        backgroundColor: isDarkMode ? "#1A1A1E" : "#ffffff",
                        borderBottom: "none",
                        color: isDarkMode ? "#5B596A" : "#96949C",
                        fontWeight: 500,
                        ...(idx === 0 && { minWidth: 200 }),
                      }}
                      align={col.key === "actions" ? "center" : "left"}
                    >
                      {col.key !== "actions" ? (
                        <TableSortLabel
                          active={orderBy === col.key}
                          direction={orderBy === col.key ? order : "asc"}
                          onClick={() => handleRequestSort(col.key)}
                          sx={{
                            color: isDarkMode ? "#5B596A" : "#96949C",
                            "&:hover": {
                              color: isDarkMode ? "#5B596A" : "#96949C",
                            },
                            "&.Mui-active": {
                              color: isDarkMode ? "#ffffff" : "#000000",
                              "& .MuiTableSortLabel-icon": {
                                color: isDarkMode ? "#ffffff" : "#000000",
                              },
                            },
                            "& .MuiTableSortLabel-icon": {
                              color: isDarkMode ? "#5B596A" : "#96949C",
                            },
                          }}
                        >
                          {col.label}
                        </TableSortLabel>
                      ) : (
                        col.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedSurveys.length > 0 ? (
                  paginatedSurveys.map((survey, index) => (
                    <TableRow
                      key={index}
                      hover
                      sx={{
                        "&:hover": { backgroundColor: "#f9fafb" },
                      }}
                    >
                      <TableCell
                        sx={{
                          borderBottom: "none",
                        }}
                        onClick={() => handleClick(survey.surveyId)}
                        className="cursor-pointer"
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <div className="p-1.5 rounded-md dark:bg-[#4F3E32] bg-[#FFEEDF]">
                            <Icon
                              icon="bx:file"
                              width="20"
                              height="20"
                              className="text-[#CD7323]"
                              fontSize="small"
                            />
                          </div>
                          <Typography
                            fontWeight={600}
                            fontSize={14}
                            sx={{
                              color: isDarkMode ? "#96949C" : "text.primary",
                            }}
                          >
                            <span className="hover:underline">
                              {survey.name}
                            </span>
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell
                        sx={{
                          borderBottom: "none",
                        }}
                      >
                        <Typography
                          fontSize={14}
                          sx={{
                            color: isDarkMode ? "#96949C" : "text.secondary",
                          }}
                        >
                          {survey.surveyId}
                        </Typography>
                      </TableCell>

                      <TableCell
                        sx={{
                          borderBottom: "none",
                        }}
                      >
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            survey?.status === "active"
                              ? "bg-[#DCFCE7] dark:bg-[#2B3336] text-[#1B803D]"
                              : survey?.status === "completed"
                              ? "bg-[#1E51B41F] dark:bg-[#1E51B41F] text-[#1E51B4]"
                              : "bg-[#FFEEDF] dark:bg-[#4F3E32]  text-[#CD7323]"
                          }`}
                        >
                          {survey?.status?.charAt(0).toUpperCase() +
                            survey?.status?.slice(1)}
                        </span>
                      </TableCell>

      
                      <TableCell
                        sx={{
                          borderBottom: "none",
                        }}
                      >
                        <Typography
                          fontSize={14}
                          sx={{
                            color: isDarkMode ? "#96949C" : "text.secondary",
                          }}
                        >
                        <Typography
  fontSize={14}
  title={
    survey.updated_at
      ? format(new Date(survey.updated_at), "PPpp")
      : ""
  }
>
  {survey.updated_at
    ? formatDistanceToNow(new Date(survey.updated_at), { addSuffix: true })
    : "N/A"}
</Typography>


                        </Typography>
                      </TableCell>

                      <TableCell
                        sx={{
                          borderBottom: "none",
                        }}
                        align="center"
                      >
                        <IconButton
                          onClick={(e) => openMenuFor(e, survey.surveyId)}
                        >
                          <MoreVertIcon className="dark:text-[#CBC9DE]" />
                        </IconButton>
                        <Menu
                          anchorEl={anchorEl}
                          open={
                            Boolean(anchorEl) &&
                            selectedSurveyId === survey.surveyId
                          }
                          onClose={closeMenu}
                          anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "right",
                          }}
                          transformOrigin={{
                            vertical: "top",
                            horizontal: "right",
                          }}
                        >
                          <MenuItem
                            onClick={() => {
                              handleClick(survey.surveyId);
                              closeMenu();
                            }}
                          >
                            <ViewIcon fontSize="small" sx={{ mr: 1 }} /> View
                            Survey
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              handleEdit(survey);
                              closeMenu();
                            }}
                            disabled={loading}
                          >
                            <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
                            Survey
                          </MenuItem>
                          {survey.status !== "published" && (
                            <MenuItem
                              onClick={() => {
                                updateSurvey(orgId, survey.surveyId, { status: "published" });
                              }}
                              disabled={loading}
                            >
                              <EditIcon fontSize="small" sx={{ mr: 1 }} /> Change Status to Published
                            </MenuItem>
                          )}
                          {survey.status !== "draft" && (
                            <MenuItem
                              onClick={() => {
                                updateSurvey(orgId, survey.surveyId, { status: "draft" });
                              }}
                              disabled={loading}
                            >
                              <EditIcon fontSize="small" sx={{ mr: 1 }} /> Change Status to Draft
                            </MenuItem>
                          )}
                          {survey.status !== "archived" && (
                            <MenuItem
                              onClick={() => {
                                updateSurvey(orgId, survey.surveyId, { status: "archived" });
                              }}
                              disabled={loading}
                            >
                              <EditIcon fontSize="small" sx={{ mr: 1 }} /> Change Status to Archived
                            </MenuItem>
                          )}
                          {survey.status !== "test" && (
                            <MenuItem
                              onClick={() => {
                                updateSurvey(orgId, survey.surveyId, { status: "test" });
                              }}
                              disabled={loading}
                            >
                              <EditIcon fontSize="small" sx={{ mr: 1 }} /> Change Status to Test
                            </MenuItem>
                          )}
                          <MenuItem
                            onClick={() => {
                              deleteSurvey(survey.surveyId);
                              closeMenu();
                            }}
                            disabled={loading}
                          >
                            <DeleteIcon
                              fontSize="small"
                              sx={{
                                mr: 1,
                                color: isDarkMode ? "#fca5a5" : "#dc2626",
                              }}
                            />
                            <span
                              style={{
                                color: isDarkMode ? "#fca5a5" : "#dc2626",
                              }}
                            >
                              Delete
                            </span>
                          </MenuItem>
                        </Menu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography
                        fontSize={14}
                        sx={{
                          color: isDarkMode ? "#96949C" : "text.secondary",
                        }}
                      >
                        No surveys found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredAndSortedSurveys.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[6, 10, 25, 50]}
            sx={{
              backgroundColor: isDarkMode ? "#1A1A1E" : "#ffffff",
              color: isDarkMode ? "#96949C" : "text.primary",
              borderTop: isDarkMode ? "1px solid #2e2e32" : "1px solid #e0e0e0",
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                {
                  color: isDarkMode ? "#96949C" : "text.secondary",
                },
              "& .MuiTablePagination-select": {
                color: isDarkMode ? "#96949C" : "text.primary",
              },
              "& .MuiIconButton-root": {
                color: isDarkMode ? "#96949C" : "text.primary",
                "&:hover": {
                  backgroundColor: isDarkMode ? "#2e2e32" : "#f5f5f5",
                },
                "&.Mui-disabled": {
                  color: isDarkMode ? "#3e3e42" : "#bdbdbd",
                },
              },
            }}
          />
        </Paper>
      )}

      {openPopup && (
        <SurveyResponsePopup
          open={openPopup}
          onClose={() => setOpenPopup(false)}
          responses={responseData}
          orgId={orgId}
          surveyId={selectedSurveyId}
        />
      )}
    </div>
  );
}
