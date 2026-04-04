from dataclasses import dataclass

@dataclass
class Person:
    name: str
    age: int

    def __post_init__(self):
        if not self.name:
            raise ValueError("Name cannot be empty")
        if self.age < 0:
            raise ValueError("Age cannot be negative")

# Example usage:
try:
    person1 = Person("Alice", 30)  # Valid
    print(f"Created person: {person1}")
    
    person2 = Person("", 25)  # Will raise ValueError
    
except ValueError as e:
    print(f"Error: {e}")

try:
    person3 = Person("Bob", -5)  # Will raise ValueError
    
except ValueError as e:
    print(f"Error: {e}")