"""Supabase client for interacting with the Testero database."""

import os
from typing import Dict, Any, Optional, List
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
# Look for .env in the project root (parent of shared/)
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)


class SupabaseClient:
    """A client for interacting with the Supabase database."""

    def __init__(self):
        """Initialize the Supabase client."""
        url: Optional[str] = os.environ.get("SUPABASE_URL")
        key: Optional[str] = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not url or not key:
            raise ValueError(
                "Supabase URL and Key must be set in environment variables or .env file.\n"
                "Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )
        
        self.client: Client = create_client(url, key)

    def get_domain_by_code(self, domain_code: str) -> Optional[Dict[str, Any]]:
        """Fetch an exam domain by its code."""
        try:
            response = self.client.table('exam_domains').select('*').eq('code', domain_code).maybe_single().execute()
            return response.data if response.data else None
        except Exception as e:
            print(f"Error fetching domain by code '{domain_code}': {e}")
            return None

    def create_generation_run(self, run_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new question generation run."""
        try:
            response = self.client.table('question_generation_runs').insert(run_data).execute()
            # Response.data is a list, get first item for single insert
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error creating generation run: {e}")
            return None

    def update_generation_run(self, run_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a question generation run."""
        try:
            response = self.client.table('question_generation_runs').update(updates).eq('id', run_id).execute()
            # Response.data is a list, get first item for single update
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error updating generation run {run_id}: {e}")
            return None

    def insert_question(self, question_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Insert a single question into the questions table."""
        try:
            response = self.client.table('questions').insert(question_data).execute()
            # Response.data is a list, get first item for single insert
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error inserting question: {e}")
            return None

    def insert_answers_batch(self, answers_data: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Insert a batch of answers into the answers table.
        
        Each answer dict should contain:
        - question_id: UUID of the question
        - choice_label: Label (A, B, C, D)
        - choice_text: The answer option text
        - is_correct: Boolean indicating if this is the correct answer
        - explanation_text: Optional explanation text for why this answer is correct/incorrect
        """
        try:
            response = self.client.table('answers').insert(answers_data).execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Error inserting answers batch: {e}")
            return []

    def insert_explanation(self, explanation_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Insert an explanation into the explanations table."""
        try:
            response = self.client.table('explanations').insert(explanation_data).execute()
            # Response.data is a list, get first item for single insert
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error inserting explanation: {e}")
            return None

    def get_question_stems_for_domain(self, exam: str, domain_id: str) -> List[str]:
        """Fetch all question stems for a given exam and domain.
        
        Used for duplicate detection - returns raw stems that will be normalized
        before comparison.
        
        Args:
            exam: Exam identifier (e.g., 'GCP_PM_ML_ENG')
            domain_id: Domain UUID
            
        Returns:
            List of question stem strings. Returns empty list on error to avoid
            blocking generation if Supabase read fails.
        """
        try:
            response = (
                self.client.table('questions')
                .select('stem')
                .eq('exam', exam)
                .eq('domain_id', domain_id)
                .execute()
            )
            if response.data:
                return [row['stem'] for row in response.data if row.get('stem')]
            return []
        except Exception as e:
            print(f"Error fetching question stems for domain {domain_id}: {e}")
            return []

    def get_question_embeddings_for_domain(self, exam: str, domain_id: str) -> List[List[float]]:
        """Fetch all question stem embeddings for a given exam and domain.
        
        Used for semantic duplicate detection - returns embedding vectors that can be
        compared using cosine similarity.
        
        Args:
            exam: Exam identifier (e.g., 'GCP_PM_ML_ENG')
            domain_id: Domain UUID
            
        Returns:
            List of embedding vectors (each is a list of floats). Only includes questions
            that have embeddings. Returns empty list on error to avoid blocking generation.
        """
        try:
            response = (
                self.client.table('questions')
                .select('stem_embedding')
                .eq('exam', exam)
                .eq('domain_id', domain_id)
                .not_.is_('stem_embedding', 'null')
                .execute()
            )
            if response.data:
                # Extract embeddings, filtering out None values
                embeddings = []
                for row in response.data:
                    embedding = row.get('stem_embedding')
                    if embedding:
                        # Supabase returns embeddings as lists, ensure it's a list of floats
                        if isinstance(embedding, list):
                            embeddings.append([float(x) for x in embedding])
                return embeddings
            return []
        except Exception as e:
            print(f"Error fetching question embeddings for domain {domain_id}: {e}")
            return []

    def update_question_embedding(self, question_id: str, embedding: List[float]) -> bool:
        """Update the stem_embedding for an existing question.
        
        Args:
            question_id: UUID of the question
            embedding: Embedding vector as list of floats (1536 dimensions for text-embedding-3-small)
            
        Returns:
            True if update succeeded, False otherwise
        """
        try:
            # Supabase expects embeddings as arrays, which Python lists serialize to correctly
            response = (
                self.client.table('questions')
                .update({'stem_embedding': embedding})
                .eq('id', question_id)
                .execute()
            )
            return response.data is not None and len(response.data) > 0
        except Exception as e:
            print(f"Error updating question embedding for question {question_id}: {e}")
            return False

    def get_existing_questions_for_domain(
        self,
        exam: str,
        domain_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch existing questions with stems and difficulty for gap analysis.
        
        Used to analyze coverage gaps before generating new questions.
        Returns a sample of existing questions to understand what's already covered.
        
        Args:
            exam: Exam identifier (e.g., 'GCP_PM_ML_ENG')
            domain_id: Domain UUID
            limit: Maximum number of questions to fetch (default: 100)
            
        Returns:
            List of question dicts with keys: stem, difficulty, status.
            Returns empty list on error to avoid blocking generation.
        """
        try:
            response = (
                self.client.table('questions')
                .select('stem,difficulty,status')
                .eq('exam', exam)
                .eq('domain_id', domain_id)
                .limit(limit)
                .execute()
            )
            if response.data:
                return [
                    {
                        'stem': row.get('stem', ''),
                        'difficulty': row.get('difficulty', 'MEDIUM'),
                        'status': row.get('status', 'DRAFT')
                    }
                    for row in response.data
                    if row.get('stem')
                ]
            return []
        except Exception as e:
            print(f"Error fetching existing questions for domain {domain_id}: {e}")
            return []
